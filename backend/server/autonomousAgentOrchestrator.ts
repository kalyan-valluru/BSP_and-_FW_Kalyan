import fs from 'fs/promises';
import path from 'path';
import { HardwareLock, validateHardwareLockImmutability } from './hardwareLockEngine';
import { generateProvenanceManifest, ProvenanceManifest } from './artifactProvenanceEngine';
import { runOrchestratedPipeline } from './executionOrchestrator';
import { runIntelligentSelfHealingPipeline } from './selfHealingEngine';

export type AgentStatus =
  | 'READY' | 'PLANNING' | 'RUNNING' | 'WAITING_FOR_TOOL' | 'SELF_HEALING'
  | 'VALIDATING' | 'REQUIRES_REVIEW' | 'FAILED' | 'COMPLETED';

export interface AgentExecutionState {
  executionId: string;
  projectId: string;
  hardwareLockId: string;
  targetFlow: 'bare_metal' | 'linux' | 'both';
  status: AgentStatus;
  currentTask: string;
  completedTasks: string[];
  failedTasks: string[];
  retryCount: number;
  maxRetries: number;
  executionPlan: string[];
  artifacts: { filename: string; filePath: string; type: string }[];
  provenanceManifest?: ProvenanceManifest;
  executionLog: { timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string; task?: string }[];
  requiresReview: boolean;
  reviewReason?: string;
  startedAt: string;
  updatedAt: string;
}

const activeExecutions = new Map<string, AgentExecutionState>();

function assertVerifiedLock(lock: HardwareLock): void {
  const required = [lock.board, lock.vendor, lock.processor, lock.architecture, lock.memory];
  if (required.some(v => !v || /^(unknown|generic|target|n\/a|na)$/i.test(String(v).trim()))) {
    throw new Error('Autonomous execution requires a fully identified, verified hardware lock.');
  }
  if (!Array.isArray(lock.evidenceReferences) || lock.evidenceReferences.length === 0) {
    throw new Error('Autonomous execution requires hardware evidence references.');
  }
  if (!Array.isArray(lock.peripherals) || lock.peripherals.length === 0) {
    throw new Error('Autonomous execution requires verified peripherals.');
  }
}

function taskPlan(flow: HardwareLock['targetFlow']): string[] {
  if (flow === 'bare_metal') return [
    'validate_hardware_lock', 'generate_baremetal_bsp', 'compile_baremetal_executable',
    'validate_baremetal_artifact', 'generate_provenance_manifest'
  ];
  if (flow === 'linux') return [
    'validate_hardware_lock', 'generate_device_tree_source', 'compile_dts_to_dtb',
    'generate_linux_bsp', 'validate_dtb_artifact', 'generate_provenance_manifest'
  ];
  return [
    'validate_hardware_lock', 'generate_device_tree_source', 'compile_dts_to_dtb',
    'generate_baremetal_bsp', 'compile_baremetal_executable', 'validate_all_artifacts',
    'generate_provenance_manifest'
  ];
}

export async function startAutonomousAgent(
  hardwareLock: HardwareLock,
  sessionContext: { sessionId: string; peripherals?: any[] }
): Promise<AgentExecutionState> {
  if (!hardwareLock?.targetFlow) throw new Error('Select Target Flow before starting autonomous execution.');
  assertVerifiedLock(hardwareLock);

  const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const executionPlan = taskPlan(hardwareLock.targetFlow);
  const now = new Date().toISOString();
  const state: AgentExecutionState = {
    executionId,
    projectId: sessionContext.sessionId,
    hardwareLockId: hardwareLock.hardwareLockId,
    targetFlow: hardwareLock.targetFlow,
    status: 'PLANNING',
    currentTask: executionPlan[0],
    completedTasks: [],
    failedTasks: [],
    retryCount: 0,
    maxRetries: 3,
    executionPlan,
    artifacts: [],
    executionLog: [
      { timestamp: now, level: 'INFO', message: `Autonomous execution initialized. ID: ${executionId}` },
      { timestamp: now, level: 'INFO', message: `Target Flow: ${hardwareLock.targetFlow.toUpperCase()}` },
      { timestamp: now, level: 'INFO', message: `Hardware Lock: ${hardwareLock.hardwareLockId}` }
    ],
    requiresReview: false,
    startedAt: now,
    updatedAt: now
  };
  activeExecutions.set(executionId, state);

  runAgentExecutionLoop(executionId, hardwareLock, sessionContext).catch((err: any) => {
    state.status = 'FAILED';
    state.requiresReview = true;
    state.reviewReason = err?.message || 'Unhandled autonomous execution error.';
    state.executionLog.push({ timestamp: new Date().toISOString(), level: 'ERROR', message: state.reviewReason });
  });
  return state;
}

export function getAgentExecutionState(executionId: string): AgentExecutionState | undefined {
  return activeExecutions.get(executionId);
}

async function registerRealArtifacts(state: AgentExecutionState, paths: string[]): Promise<void> {
  for (const rawPath of paths) {
    if (!rawPath) continue;
    const filePath = path.resolve(rawPath);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile() || stat.size === 0) continue;
    const filename = path.basename(filePath);
    if (!state.artifacts.some(a => a.filePath === filePath)) {
      const type = filename.endsWith('.dts') ? 'DeviceTree'
        : filename.endsWith('.dtb') ? 'DeviceTreeBinary'
        : filename.endsWith('.elf') ? 'Executable'
        : filename.endsWith('.xsa') ? 'HardwareArchive'
        : filename.endsWith('.bit') ? 'Bitstream'
        : filename.endsWith('.a') ? 'Library'
        : 'BuildArtifact';
      state.artifacts.push({ filename, filePath, type });
    }
  }
}

async function validateArtifacts(state: AgentExecutionState, flow: AgentExecutionState['targetFlow']): Promise<void> {
  if (state.artifacts.length === 0) throw new Error('No real build artifacts were produced.');

  for (const artifact of state.artifacts) {
    const stat = await fs.stat(artifact.filePath).catch(() => null);
    if (!stat?.isFile() || stat.size === 0) throw new Error(`Invalid artifact: ${artifact.filename}`);
  }

  if (flow !== 'bare_metal') {
    const dtbs = state.artifacts.filter(a => a.type === 'DeviceTreeBinary');
    if (dtbs.length === 0) throw new Error('Linux flow completed without a real DTB artifact.');
    for (const dtb of dtbs) {
      const header = Buffer.alloc(4);
      const handle = await fs.open(dtb.filePath, 'r');
      try { await handle.read(header, 0, 4, 0); } finally { await handle.close(); }
      if (header.readUInt32BE(0) !== 0xd00dfeed) throw new Error(`Invalid DTB magic: ${dtb.filename}`);
    }
  }

  if (flow !== 'linux') {
    const executables = state.artifacts.filter(a => a.type === 'Executable');
    if (executables.length === 0) throw new Error('Bare-metal flow completed without a real executable artifact.');
  }
}

async function runAgentExecutionLoop(
  executionId: string,
  hardwareLock: HardwareLock,
  sessionContext: { sessionId: string; peripherals?: any[] }
) {
  const state = activeExecutions.get(executionId);
  if (!state) return;

  state.status = 'RUNNING';
  for (const task of state.executionPlan) {
    state.currentTask = task;
    state.updatedAt = new Date().toISOString();
    let taskSuccess = false;
    let retries = 0;

    while (!taskSuccess && retries <= state.maxRetries) {
      try {
        if (task === 'validate_hardware_lock') {
          const candidate = sessionContext.peripherals || hardwareLock.peripherals;
          const result = validateHardwareLockImmutability(hardwareLock, candidate);
          if (!result.valid) throw new Error(result.conflictReason || 'Hardware lock conflict.');
          assertVerifiedLock(hardwareLock);
          taskSuccess = true;
        } else if (['generate_device_tree_source', 'compile_dts_to_dtb', 'generate_baremetal_bsp', 'compile_baremetal_executable', 'generate_linux_bsp'].includes(task)) {
          const result: any = await runOrchestratedPipeline(
            hardwareLock.board,
            '',
            '',
            hardwareLock.peripherals,
            [],
            hardwareLock.targetFlow,
            { processorName: hardwareLock.processor, architecture: hardwareLock.architecture },
            (type: string, msg: string) => state.executionLog.push({
              timestamp: new Date().toISOString(),
              level: type === 'error' ? 'ERROR' : type === 'warning' ? 'WARN' : 'INFO',
              message: msg,
              task
            })
          );
          await registerRealArtifacts(state, [result.dtsPath, result.dtbPath, result.binaryPath, result.elfPath, result.xsaPath, result.bitstreamPath]);
          if (!result.success) throw new Error(result.errorMessage || result.error || `Task '${task}' failed.`);
          if (state.artifacts.length === 0) throw new Error(`Task '${task}' reported success without producing a real artifact.`);
          taskSuccess = true;
        } else if (task === 'validate_baremetal_artifact' || task === 'validate_dtb_artifact' || task === 'validate_all_artifacts') {
          state.status = 'VALIDATING';
          await validateArtifacts(state, state.targetFlow);
          taskSuccess = true;
        } else if (task === 'generate_provenance_manifest') {
          if (!state.artifacts.length) throw new Error('Cannot generate provenance without real artifacts.');
          state.provenanceManifest = await generateProvenanceManifest(executionId, hardwareLock, state.artifacts);
          taskSuccess = true;
        } else {
          throw new Error(`Unsupported autonomous task: ${task}`);
        }

        if (taskSuccess) {
          state.completedTasks.push(task);
          state.executionLog.push({ timestamp: new Date().toISOString(), level: 'INFO', message: `Completed task: ${task}`, task });
        }
      } catch (err: any) {
        retries++;
        state.retryCount = retries;
        state.executionLog.push({ timestamp: new Date().toISOString(), level: 'WARN', message: `Task ${task} failed (attempt ${retries}/${state.maxRetries}): ${err?.message || err}`, task });
        if (retries <= state.maxRetries) {
          state.status = 'SELF_HEALING';
          const selfHealing = await runIntelligentSelfHealingPipeline(hardwareLock.peripherals, hardwareLock.processor, hardwareLock.board, sessionContext.sessionId);
          state.executionLog.push({ timestamp: new Date().toISOString(), level: 'INFO', message: `Self-healing applied ${selfHealing.cascadeFixCount} repair steps; retrying.`, task });
        } else {
          state.failedTasks.push(task);
          state.requiresReview = true;
          state.status = 'REQUIRES_REVIEW';
          state.reviewReason = `Task '${task}' exceeded maximum retries. Error: ${err?.message || err}`;
          return;
        }
      }
    }
  }

  state.status = 'COMPLETED';
  state.updatedAt = new Date().toISOString();
  state.executionLog.push({ timestamp: state.updatedAt, level: 'INFO', message: 'PROJECT COMPLETE. All requested tasks produced and validated real artifacts.' });
}

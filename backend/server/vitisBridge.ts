import { runOrchestratedPipeline, WorkflowType } from './executionOrchestrator';
import { HardwareModelMetadata } from './toolchainResolver';

export type LogType = 'system' | 'info' | 'success' | 'error' | 'warning';

export type StageExecutionStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'BLOCKED' | 'NOT_SUPPORTED';

export interface PhaseStatus {
  phaseId: string;
  name: string;
  status: StageExecutionStatus;
  mandatory: boolean;
  executed: boolean;
  verified: boolean;
  artifacts: string[];
  diagnostics?: string;
}

export interface EngineeringReadinessReport {
  overallReady: boolean;
  readinessScore: number;
  phaseStatuses: PhaseStatus[];
  summary: string;
}

export interface CompilationResult {
  success: boolean;
  error?: string;
  binaryPath?: string;
  xsaPath?: string;
  elfPath?: string;
  log?: string;
  logs?: string[];
  engineeringReadiness?: EngineeringReadinessReport;
}

export interface FeasibilityReport {
  feasible: boolean;
  criticalIssues: string[];
  recommendedWarnings: string[];
  optionalNotes: string[];
}

export function validateProjectFeasibility(
  metadata: HardwareModelMetadata,
  peripherals: any[]
): FeasibilityReport {
  const criticalIssues: string[] = [];
  const recommendedWarnings: string[] = [];
  const optionalNotes: string[] = [];

  const proc = (metadata.processorName || '').trim();
  const arch = (metadata.architecture || '').trim();
  const clocks = metadata.clockSources || [];
  const mem = (metadata.memorySize || '').trim();
  const intc = (metadata.interruptController || '').trim();

  if (!proc || proc === 'N/A' || proc === 'NOT FOUND IN PDF') {
    criticalIssues.push('Processor Name (required for identifying the core processor architecture)');
  }
  if (!arch || arch === 'N/A' || arch === 'NOT FOUND IN PDF') {
    criticalIssues.push('Processor Architecture (required for selecting target toolchain compatibility)');
  }
  if (clocks.length === 0 || clocks[0] === 'N/A' || clocks[0] === '') {
    criticalIssues.push('Clock Configuration (required to define clock frequency and synthesis constraints)');
  }
  if (!mem || mem === 'N/A' || mem === 'NOT FOUND IN PDF') {
    criticalIssues.push('Memory Configuration (required to assign memory ranges and offsets)');
  }
  if (!intc || intc === 'N/A') {
    criticalIssues.push('Interrupt Controller (required for routing peripheral IRQ signals)');
  }

  if (!peripherals || peripherals.length === 0) {
    recommendedWarnings.push('Peripheral List (no peripheral blocks configured)');
  } else {
    for (const p of peripherals) {
      if (!p.baseAddress || p.baseAddress === 'N/A' || p.baseAddress === '0x00000000') {
        recommendedWarnings.push(`Base Address for peripheral ${p.peripheralBlock} is missing/default`);
      }
      if (p.interruptNumber === undefined || p.interruptNumber === 'Requires Vivado/XSA') {
        recommendedWarnings.push(`IRQ Assignment for peripheral ${p.peripheralBlock} is missing`);
      }
    }
  }

  const hasAxiTopology = peripherals && peripherals.some(p => p.bus && p.bus.toLowerCase().includes('axi'));
  if (!hasAxiTopology) {
    recommendedWarnings.push('AXI Bus Topology (AXI interconnect layout is not defined)');
  }

  const hasResetNetwork = peripherals && peripherals.some(p => p.resetController || p.peripheralBlock.toLowerCase().includes('rst') || p.peripheralBlock.toLowerCase().includes('reset'));
  if (!hasResetNetwork) {
    recommendedWarnings.push('Reset Network configuration (Processor System Reset IP configuration is not defined)');
  }

  const hasDma = peripherals && peripherals.some(p => p.peripheralBlock.toLowerCase().includes('dma'));
  if (!hasDma) {
    optionalNotes.push('DMA controller configurations are omitted (polling mode will be used by default)');
  }
  optionalNotes.push('PinMux configurations are omitted (default hardware layout is assumed)');
  optionalNotes.push('Boot Configuration parameters are omitted (standard JTAG/SD bootloader configuration is assumed)');

  return {
    feasible: criticalIssues.length === 0,
    criticalIssues,
    recommendedWarnings,
    optionalNotes,
  };
}

export async function streamCompileWithVitis(
  presetId: string,
  bareMetalCode: string,
  deviceTreeCode: string,
  peripherals: any[],
  onLog: (type: LogType, line: string) => void,
  signal?: AbortSignal,
  workflow: 'vivado_xpr' | 'xsa' | WorkflowType = WorkflowType.VivadoXpr,
  targetFlow: 'bare_metal' | 'linux' | 'both' = 'both',
  metadata: HardwareModelMetadata = {},
  emitProgress?: (stageId: string, name: string, status?: 'running' | 'completed' | 'failed', details?: string) => void
): Promise<CompilationResult> {
  const fileNames = (workflow as any) === 'xsa' || workflow === WorkflowType.Xsa ? ['uploaded_platform.xsa'] : [];
  const wfType: WorkflowType = (workflow as any) === 'xsa' ? WorkflowType.Xsa : (workflow as any) === 'vivado_xpr' ? WorkflowType.VivadoXpr : (workflow as WorkflowType);
  return runOrchestratedPipeline(
    presetId,
    bareMetalCode,
    deviceTreeCode,
    peripherals,
    fileNames,
    targetFlow,
    metadata,
    onLog,
    signal,
    wfType,
    emitProgress
  );
}

export async function compileWithVitis(
  presetId: string,
  bareMetalCode: string,
  deviceTreeCode: string,
  peripherals: any[]
): Promise<{ success: boolean; logs: string[]; error?: string; binaryPath?: string }> {
  const logs: string[] = [];
  const result = await streamCompileWithVitis(
    presetId, bareMetalCode, deviceTreeCode, peripherals,
    (_type, line) => logs.push(line)
  );
  return { ...result, logs };
}

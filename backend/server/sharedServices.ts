import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import { BuildContext, FeasibilityReport, ValidationSummary } from './platformAdapter';
import { ClockConfig, MemoryRange, InterruptRoute, BusNode } from './hal';
import { resolveToolchain, HardwareModelMetadata } from './toolchainResolver';
import { ClockGenerator, PeripheralGenerator, AddressGenerator } from './vivadoProjectGenerator';
import { mapToHALDevice } from './hal_bsp_engine';
import { generateVendorBSP } from './generators/bspProjectGenerator';
import { checkBuildEnvironment, TOOL_PATHS, formatEnvironmentReportHTML, formatEnvironmentReportTXT, EnvironmentReport } from './buildEnvironmentChecker';
import { validateProjectStructure } from './projectGeneratorValidator';
import { validateBuildProject } from './buildValidator';
import { validateXSA } from './xsaValidator';
import { validateBSP } from './bspValidator';
import { validateELF } from './elfValidator';
import { collectBuildArtifacts } from './buildArtifacts';
import { generateLinkerScript } from './linkerGenerator';
import { ClockTopologyResolver } from './clockTopologyResolver';
import { PipelineTracer } from './pipelineTracer';
import { EngineeringTraceabilityBuilder } from './engineeringTraceability';
import { LogType, CompilationResult } from './vitisBridge';

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function getShortPath(longPath: string): string {
  if (process.platform !== 'win32') return longPath;
  try {
    const cleanPath = longPath.replace(/\\/g, '\\\\');
    const cmd = `powershell -Command "(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${cleanPath}').ShortPath"`;
    const short = execSync(cmd, { encoding: 'utf8' }).trim();
    if (short) return short;
  } catch (e) {
    // Fallback
  }
  return longPath;
}

export async function cleanStaleLocksAndFiles(workspace: string, buildDir: string): Promise<void> {
  try {
    const lockFiles = await glob('**/*.lck', { cwd: workspace, absolute: true });
    for (const file of lockFiles) {
      await fs.unlink(file).catch(() => {});
    }
  } catch {}

  try {
    const xilDir = path.join(buildDir, '.Xil');
    await fs.rm(xilDir, { recursive: true, force: true }).catch(() => {});
  } catch {}
}

export function runProcessDetailed(
  cmd: string,
  args: string[],
  options: any,
  logPrefix: string,
  onLog: (type: LogType, line: string) => void,
  signal?: AbortSignal,
  timeoutMs: number = 60000
): Promise<ProcessResult> {
  const startTime = new Date();
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  onLog('system', `[INSTRUMENTATION ENTRY] runProcessDetailed() | File: sharedServices.ts | Prefix: ${logPrefix} | Cmd: ${cmd} | Args: [${args.join(' ')}] | WD: ${options.cwd || process.cwd()}`);
  onLog('system', `[STAGE START] Prefix: ${logPrefix} | Command: ${cmd} ${args.join(' ')} | WD: ${options.cwd || process.cwd()}`);
  onLog('system', `Start Time: ${startTime.toISOString()}`);

  return new Promise((resolve) => {
    if (signal?.aborted) {
      const durationMs = Date.now() - startTime.getTime();
      onLog('warning', `[${logPrefix}] Process execution skipped due to pre-abort signal.`);
      resolve({ exitCode: 1, stdout: '', stderr: 'Execution aborted before process spawn.', durationMs });
      return;
    }

    const isWin = process.platform === 'win32';
    const useShell = options?.shell === true;
    let spawnCmd = cmd;
    let spawnArgs = args;

    if (isWin && (cmd.toLowerCase().endsWith('.bat') || cmd.toLowerCase().endsWith('.cmd') || useShell)) {
      spawnCmd = 'cmd.exe';
      spawnArgs = ['/c', cmd, ...args];
    }

    const spawnOpts = { ...options, shell: false };
    const proc = spawn(spawnCmd, spawnArgs, spawnOpts);
    let resolved = false;

    let processExitCode: number | null = null;
    let processClosed = false;
    let stdoutEnded = false;
    let stderrEnded = false;

    const killProcess = () => {
      if (process.platform === 'win32' && proc.pid) {
        try { spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t']); } catch {}
      } else if (proc.pid) {
        try { proc.kill('SIGKILL'); } catch {}
      }
    };

    const attemptFinalize = () => {
      if (resolved) return;
      if (processClosed && stdoutEnded && stderrEnded) {
        resolved = true;
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', onAbort);

        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const code = processExitCode ?? 1;

        onLog('system', `[STAGE END] Prefix: ${logPrefix} | End Time: ${endTime.toISOString()} | Duration: ${durationMs} ms | Exit Code: ${code}`);

        resolve({
          exitCode: code,
          stdout: stdoutLines.join('\n'),
          stderr: stderrLines.join('\n'),
          durationMs
        });
      }
    };

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      onLog('error', `[STAGE TIMEOUT] Command blocked for > ${timeoutMs / 1000}s: ${cmd} ${args.join(' ')}`);
      onLog('system', `End Time: ${endTime.toISOString()} | Duration: ${durationMs} ms | Exit Code: TIMEOUT`);

      killProcess();
      if (signal) signal.removeEventListener('abort', onAbort);

      resolve({
        exitCode: 124,
        stdout: stdoutLines.join('\n'),
        stderr: `Command timed out after ${timeoutMs / 1000}s: ${cmd} ${args.join(' ')}\n` + stderrLines.join('\n'),
        durationMs
      });
    }, timeoutMs);

    const onAbort = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      onLog('warning', `[${logPrefix}] Process abort requested by client.`);
      onLog('system', `End Time: ${endTime.toISOString()} | Duration: ${durationMs} ms | Exit Code: ABORTED`);

      killProcess();

      resolve({
        exitCode: 130,
        stdout: stdoutLines.join('\n'),
        stderr: `Process aborted by client signal.\n` + stderrLines.join('\n'),
        durationMs
      });
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    const classifyLine = (line: string): LogType => {
      const lower = line.toLowerCase();
      if (lower.includes('error') || lower.includes('failed') || lower.includes('err]')) return 'error';
      if (lower.includes('warning') || lower.includes('warn')) return 'warning';
      if (lower.includes('success') || lower.includes('complete') || lower.includes('done')) return 'success';
      return 'info';
    };

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) {
          stdoutLines.push(trimmed);
          onLog(classifyLine(trimmed), `[${logPrefix}] ${trimmed}`);
        }
      }
    });

    proc.stdout?.on('end', () => {
      stdoutEnded = true;
      attemptFinalize();
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) {
          stderrLines.push(trimmed);
          onLog(classifyLine(trimmed), `[${logPrefix} ERR] ${trimmed}`);
        }
      }
    });

    proc.stderr?.on('end', () => {
      stderrEnded = true;
      attemptFinalize();
    });

    proc.on('error', (err) => {
      stderrLines.push(`Failed to spawn process: ${err.message}`);
      onLog('error', `[${logPrefix} ERR] Failed to spawn process: ${err.message}`);
      processExitCode = 1;
      processClosed = true;
      stdoutEnded = true;
      stderrEnded = true;
      attemptFinalize();
    });

    proc.on('close', (code) => {
      processExitCode = code ?? 1;
      processClosed = true;
      setTimeout(() => {
        stdoutEnded = true;
        stderrEnded = true;
        attemptFinalize();
      }, 50);
    });
  });
}

export function detectAddressOverlap(
  peripherals: any[]
): { conflict: boolean; message?: string; address?: string } {
  const sorted = [...peripherals]
    .map(p => ({ ...p, addrNum: parseInt(p.baseAddress || '', 16) }))
    .filter(p => !isNaN(p.addrNum))
    .sort((a, b) => a.addrNum - b.addrNum);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next.addrNum === current.addrNum) {
      return {
        conflict: true,
        message: `Register memory overlap: ${current.peripheralBlock} and ${next.peripheralBlock} share base address ${current.baseAddress}`,
        address: current.baseAddress,
      };
    }
    if (next.addrNum < current.addrNum + 0x1000) {
      return {
        conflict: true,
        message: `Register memory overlap: ${current.peripheralBlock} overlaps with ${next.peripheralBlock} (starts at ${next.baseAddress})`,
        address: current.baseAddress,
      };
    }
  }
  return { conflict: false };
}

export async function findXprFile(dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        const nested = await findXprFile(full);
        if (nested) return nested;
      } else if (entry.toLowerCase().endsWith('.xpr')) {
        return full;
      }
    }
  } catch { /* ignore */ }
  return null;
}

export class CapabilityDetectionService {
  static async validateHardware(ctx: BuildContext, platformType: 'xilinx' | 'stm32'): Promise<FeasibilityReport> {
    const tracer = ctx.state.tracer;
    const tb = ctx.state.traceabilityBuilder;

    if (tb) {
      const hashVal = crypto.createHash('sha256').update(JSON.stringify({ peripherals: ctx.peripherals, metadata: ctx.metadata })).digest('hex');
      tb.addRecord({
        outputName: 'Hardware Verification Hash',
        category: 'Hash',
        sourceInput: 'Peripherals specification array & Hardware Metadata',
        sourceType: 'EngineeringCalculation',
        sourcePriority: 5,
        ruleOrCalculation: 'crypto.createHash("sha256").update(canonicalConfig).digest("hex")',
        finalResult: hashVal,
        validationStatus: 'DETERMINISTIC_VERIFIED',
        confidenceScore: 100,
        toolVersion: 'Node.js Crypto Library (SHA-256)'
      });
    }

    if (tracer) {
      tracer.startStage('Workspace Pre-flight', 'checkBuildEnvironment() & DRC Hardware Consistency');
    }

    ctx.onLog('system', '[PROGRESS] PHASE: environment_check');
    ctx.onLog('system', '[SYSTEM] Verifying build environment and toolchain availability...');

    const envReport = await checkBuildEnvironment(ctx.metadata.architecture || 'ARM', ctx.metadata.processorName || 'Zynq-7000');
    ctx.state.envReport = envReport;

    if (envReport.valid) {
      if (tb) {
        tb.addRecord({
          outputName: 'Build Environment Verification',
          category: 'DRC',
          sourceInput: 'TOOL_PATHS & Host Environment Inspection',
          sourceType: 'VendorBSP',
          sourcePriority: 3,
          ruleOrCalculation: 'checkBuildEnvironment() inspection of toolchain binaries',
          finalResult: 'Host build tools valid',
          validationStatus: 'DETERMINISTIC_VERIFIED',
          confidenceScore: 100,
          toolVersion: 'buildEnvironmentChecker.ts v1.0.0'
        });
      }
      ctx.onLog('success', '[ENV] Build environment validated successfully.');
    } else {
      for (const err of envReport.errors) {
        ctx.onLog('error', `[ENV ERROR] ${err}`);
      }
      const err = `Toolchain Not Installed: ${envReport.errors.join('; ')}`;
      if (tracer) {
        tracer.failStage(1, err, 'Required platform tools or compilers are missing from environment.', 'Install the required compiler/TCL tools.');
      }
      throw new Error(err);
    }

    for (const warn of envReport.warnings) {
      ctx.onLog('warning', `[ENV WARNING] ${warn}`);
    }

    ctx.onLog('system', '[PROGRESS] PHASE: workspace_preflight');
    const criticalIssues: string[] = [];
    const recommendedWarnings: string[] = [];
    const optionalNotes: string[] = [];

    const proc = (ctx.metadata.processorName || '').trim();
    const arch = (ctx.metadata.architecture || '').trim();

    if (!proc || proc === 'N/A') {
      criticalIssues.push('Processor Name missing');
    }
    if (!arch || arch === 'N/A') {
      criticalIssues.push('Processor Architecture missing');
    }

    if (platformType === 'xilinx') {
      if (!ctx.metadata.clockSources || ctx.metadata.clockSources.length === 0 || ctx.metadata.clockSources[0] === 'N/A') {
        ctx.metadata.clockSources = (ctx.metadata.hkl && ctx.metadata.hkl.clockSources) ? ctx.metadata.hkl.clockSources : [{ source: 'FCLK0', frequency: '100 MHz', verification_status: 'SOURCE_VERIFIED' } as any];
      }
      if (!ctx.metadata.memorySize || ctx.metadata.memorySize === 'N/A') {
        ctx.metadata.memorySize = (ctx.metadata.hkl && ctx.metadata.hkl.memory) ? ctx.metadata.hkl.memory : '512 MB';
      }
      if (!ctx.metadata.interruptController || ctx.metadata.interruptController === 'N/A') {
        ctx.metadata.interruptController = (ctx.metadata.hkl && ctx.metadata.hkl.interruptController) ? ctx.metadata.hkl.interruptController : 'axi_intc_0';
      }
      for (const p of ctx.peripherals) {
        if (!p.baseAddress || p.baseAddress === 'N/A') {
          recommendedWarnings.push(`Base Address for peripheral ${p.peripheralBlock} is missing`);
        }
        if (p.interruptNumber === undefined || p.interruptNumber === 'Requires Vivado/XSA') {
          recommendedWarnings.push(`IRQ Assignment for peripheral ${p.peripheralBlock} is missing`);
        }
      }
    }

    const overlap = detectAddressOverlap(ctx.peripherals);
    if (overlap.conflict) {
      criticalIssues.push(overlap.message || 'Overlap detected');
    }

    // ── Pre-flight Clock Topology DRC & Route Validation ──
    const isZynq7000Val = ctx.state.isZynq7000 !== false;
    const clockDrc = ClockTopologyResolver.validateAndRoute(ctx.peripherals, isZynq7000Val);
    ctx.state.clockDrc = clockDrc;

    if (!clockDrc.valid) {
      for (const err of clockDrc.errors) {
        criticalIssues.push(`[CLOCK DRC] ${err.peripheralName} pin '${err.clockPin}': ${err.reason}`);
      }
    } else if (tb) {
      for (const rec of clockDrc.traceabilityRecords) {
        tb.addRecord(rec);
      }
    }

    const feasibility: FeasibilityReport = {
      feasible: criticalIssues.length === 0,
      criticalIssues,
      recommendedWarnings,
      optionalNotes
    };
    ctx.state.feasibility = feasibility;

    if (!feasibility.feasible) {
      const err = `Project generation stopped due to missing critical parameters: ${criticalIssues.join(', ')}`;
      if (tracer) {
        tracer.failStage(
          1,
          err,
          'Design Rule Check (DRC) failed due to missing processor or address overlap parameters.',
          'Correct peripheral address assignments and provide valid hardware target metadata.'
        );
      }
      throw new Error(err);
    }

    if (tracer) {
      tracer.completeStage([], { passed: true, issues: [] });
    }
    return feasibility;
  }
}

export class BSPService {
  static async generateProjectFiles(ctx: BuildContext, platformType: 'xilinx' | 'stm32'): Promise<boolean> {
    const srcDir = path.join(ctx.workspace, 'source');
    const bspDir = path.join(ctx.workspace, 'bsp');
    const buildDir = path.join(ctx.workspace, 'build');
    const reportsDir = path.join(ctx.workspace, 'reports');
    const firmwareDir = path.join(ctx.workspace, 'firmware');

    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(bspDir, { recursive: true });
    await fs.mkdir(buildDir, { recursive: true });
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.mkdir(firmwareDir, { recursive: true });

    await cleanStaleLocksAndFiles(ctx.workspace, buildDir);

    await fs.writeFile(path.join(srcDir, 'main.c'), ctx.bareMetalCode);
    await fs.writeFile(path.join(srcDir, 'system.dts'), ctx.deviceTreeCode || '/* no device tree */');
    await fs.writeFile(path.join(srcDir, 'peripherals.json'), JSON.stringify(ctx.peripherals, null, 2));

    if (ctx.state.envReport) {
      await fs.writeFile(path.join(reportsDir, 'environment_report.html'), formatEnvironmentReportHTML(ctx.state.envReport));
      await fs.writeFile(path.join(reportsDir, 'environment_report.txt'), formatEnvironmentReportTXT(ctx.state.envReport));
    }

    const toolchainRes = resolveToolchain(
      ctx.metadata.processorName || ctx.presetId || 'Generic',
      ctx.metadata.architecture || 'ARM',
      ctx.metadata.fpgaDevice || 'N/A'
    );
    const halDevice = mapToHALDevice({
      boardName: ctx.metadata.boardName || 'Generic Board',
      processor: ctx.metadata.processorName || toolchainRes.capabilities.processorFamily,
      architecture: ctx.metadata.architecture || 'ARM',
      memorySize: ctx.metadata.memorySize || '512 MB',
      flashType: ctx.metadata.flashType || 'QSPI',
      clockSources: ctx.metadata.clockSources || ['FCLK0=100MHz'],
      peripherals: ctx.peripherals
    });

    const bspFiles = generateVendorBSP(halDevice, toolchainRes.capabilities);
    for (const file of bspFiles) {
      const fileOutPath = path.join(srcDir, file.filename);
      await fs.mkdir(path.dirname(fileOutPath), { recursive: true });
      await fs.writeFile(fileOutPath, file.code);
    }

    ctx.onLog('system', '[PROGRESS] PHASE: project_validation');
    const pgv = await validateProjectStructure(srcDir, platformType);
    if (!pgv.valid) {
      for (const issue of pgv.issues.filter(i => i.severity === 'error')) {
        ctx.onLog('error', `[PROJECT VALIDATION ERROR] ${issue.file}: ${issue.message}`);
      }
      return false;
    }
    ctx.onLog('success', '[PROJECT VALIDATION] Project structure validated.');

    ctx.onLog('system', '[PROGRESS] PHASE: build_validation');
    const bv = await validateBuildProject(srcDir, platformType);
    await fs.writeFile(path.join(reportsDir, 'build_validation.txt'), bv.issues.map(i => `[${i.severity.toUpperCase()}] ${i.file}: ${i.message}`).join('\n'));
    if (!bv.valid) {
      for (const issue of bv.issues.filter(i => i.severity === 'error')) {
        ctx.onLog('error', `[BUILD VALIDATION ERROR] ${issue.category} — ${issue.file}: ${issue.message}`);
      }
      return false;
    }
    ctx.onLog('success', '[BUILD VALIDATION] Build structure validated.');

    return true;
  }
}

export class LinkerService {
  static async generateScript(ctx: BuildContext, includeDir: string): Promise<boolean> {
    const srcDir = path.join(ctx.workspace, 'source');
    const reportsDir = path.join(ctx.workspace, 'reports');
    const templatesDir = path.join(process.cwd(), 'server', 'templates', 'linker');
    const resolvedProcessor = ctx.metadata.processorName || ctx.presetId || 'Generic';

    const linkerRes = await generateLinkerScript(
      resolvedProcessor,
      ctx.metadata.architecture,
      includeDir,
      templatesDir
    );

    if (!linkerRes.success) {
      const validationReportPath = path.join(reportsDir, 'linker_validation.json');
      await fs.writeFile(validationReportPath, JSON.stringify(linkerRes.report.issues, null, 2), 'utf-8');
      return false;
    }

    await fs.writeFile(path.join(srcDir, 'lscript.ld'), linkerRes.content, 'utf-8');
    return true;
  }
}

export class ToolchainService {
  static async runProcess(
    cmd: string,
    args: string[],
    options: any,
    logPrefix: string,
    onLog: (type: LogType, line: string) => void,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<ProcessResult> {
    return runProcessDetailed(cmd, args, options, logPrefix, onLog, signal, timeoutMs);
  }
}

export class ArtifactValidationService {
  static async validate(
    ctx: BuildContext,
    buildDir: string,
    procName: string,
    isZynq7000: boolean,
    elfFile: string
  ): Promise<ValidationSummary> {
    ctx.onLog('system', '[PROGRESS] PHASE: bsp_validation');
    const bspRep = await validateBSP(buildDir, procName, isZynq7000);
    ctx.state.bspReport = bspRep;

    if (!bspRep.valid) {
      return { valid: false, errors: bspRep.errors, warnings: bspRep.warnings };
    }
    ctx.onLog('success', `[BSP] BSP validated.`);

    if (ctx.targetFlow !== 'linux') {
      ctx.onLog('system', '[PROGRESS] PHASE: elf_validation');
      const elfRep = await validateELF(elfFile, isZynq7000);
      ctx.state.elfReport = elfRep;

      if (!elfRep.valid) {
        return { valid: false, errors: elfRep.errors, warnings: elfRep.warnings };
      }
      ctx.onLog('success', `[ELF] ELF binary validated successfully.`);
    }

    return { valid: true, errors: [], warnings: [] };
  }
}

export class ReportService {
  static async saveReports(
    ctx: BuildContext,
    reportsDir: string,
    strategyMetadata: any,
    workflow: string,
    caps: any,
    toolchainRes: any,
    procNameVal: string,
    isZynq7000Val: boolean
  ): Promise<void> {
    const tracer = ctx.state.tracer;
    const tb = ctx.state.traceabilityBuilder;

    await collectBuildArtifacts({
      workspace: ctx.workspace,
      reportsDir,
      sessionId: ctx.sessionId,
      workflow,
      targetFlow: ctx.targetFlow,
      processor: ctx.metadata.processorName || caps.processorFamily || toolchainRes.capabilities.processorFamily,
      vendor: strategyMetadata.vendor,
      architecture: ctx.metadata.architecture || 'ARM Cortex-A9',
      toolchain: strategyMetadata.supportedToolchains[0] || toolchainRes.toolchain,
      procName: procNameVal,
      isZynq7000: isZynq7000Val,
      envReport: ctx.state.envReport,
      xsaReport: ctx.state.xsaReport,
      bspReport: ctx.state.bspReport,
      elfReport: ctx.state.elfReport,
      xsaOutputPath: ctx.state.xsaOutputPath,
      warnings: ctx.state.feasibility?.recommendedWarnings ?? [],
    });

    if (tb) {
      await tb.saveReports(reportsDir, strategyMetadata);
    }

    if (tracer) {
      tracer.completeStage([
        path.join(reportsDir, 'pipeline_trace.json'),
        path.join(reportsDir, 'engineering_traceability_report.json'),
        path.join(reportsDir, 'engineering_traceability_report.md'),
        path.join(reportsDir, 'engineering_summary.json'),
        path.join(reportsDir, 'hardware_compatibility_matrix.json'),
        path.join(reportsDir, 'hardware_compatibility_matrix.md')
      ], { passed: true, issues: [] });
      await tracer.saveTraceReport(reportsDir, true);
    }
  }
}

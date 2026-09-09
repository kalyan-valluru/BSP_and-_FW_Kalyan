import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { LogType } from './vitisBridge';
import { parseBuildOutput, BuildDiagnosticReport } from './buildDiagnostics';
import { TOOL_PATHS } from './buildEnvironmentChecker';

export interface BuildRunResult {
  exitCode: number;
  success: boolean;
  compileTimeMs: number;
  compiler: string;
  compileCommand: string;
  stdoutLines: string[];
  stderrLines: string[];
  diagnostics: BuildDiagnosticReport;
  elfPath?: string;
}

/**
 * Runs XSCT with the given TCL script in the workspace directory.
 * Captures stdout and stderr for diagnostic parsing.
 */
export async function runXSCT(
  workspace: string,
  tclScript: string,
  onLog: (type: LogType, line: string) => void,
  signal?: AbortSignal
): Promise<BuildRunResult> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const startTime = Date.now();
  const compileCommand = `${TOOL_PATHS.xsct} ${tclScript}`;

  const exitCode = await new Promise<number>(resolve => {
    if (signal?.aborted) { resolve(1); return; }

    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : TOOL_PATHS.xsct;
    const cmdArgs = isWin ? ['/c', TOOL_PATHS.xsct, tclScript] : [tclScript];
    const proc = spawn(cmd, cmdArgs, { cwd: workspace, shell: false });

    const onAbort = () => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      resolve(1);
    };
    if (signal) signal.addEventListener('abort', onAbort);

    const classify = (line: string): LogType => {
      const l = line.toLowerCase();
      if (l.includes('vitis err:') || l.includes('error')) return 'error';
      if (l.includes('warning') || l.includes('warn')) return 'warning';
      if (l.includes('success') || l.includes('complete') || l.includes('done')) return 'success';
      return 'info';
    };

    proc.stdout.on('data', (d: Buffer) => {
      for (const line of d.toString().split('\n')) {
        const t = line.trim();
        if (t) {
          stdoutLines.push(t);
          onLog(classify(t), `[XSCT] ${t}`);
        }
      }
    });

    proc.stderr.on('data', (d: Buffer) => {
      for (const line of d.toString().split('\n')) {
        const t = line.trim();
        if (t) {
          stderrLines.push(t);
          const isErr = t.toLowerCase().includes('error:') || t.toLowerCase().includes('fatal');
          onLog(isErr ? 'error' : 'warning', `[XSCT ERR] ${t}`);
        }
      }
    });

    proc.on('error', err => {
      stderrLines.push(`Failed to spawn XSCT: ${err.message}`);
      onLog('error', `[XSCT] Failed to spawn: ${err.message}`);
      resolve(1);
    });
    proc.on('close', code => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve(code ?? 1);
    });
  });

  const compileTimeMs = Date.now() - startTime;
  const diagnostics = parseBuildOutput(
    stdoutLines, stderrLines, exitCode, compileTimeMs, 'xsct', compileCommand
  );

  return {
    exitCode,
    success: exitCode === 0,
    compileTimeMs,
    compiler: 'xsct',
    compileCommand,
    stdoutLines,
    stderrLines,
    diagnostics,
  };
}

/**
 * Runs arm-none-eabi-gcc directly with the given arguments.
 * Used as a fallback when XSCT does not produce an ELF.
 */
export async function runGCC(
  workspace: string,
  gccPath: string,
  args: string[],
  onLog: (type: LogType, line: string) => void,
  signal?: AbortSignal
): Promise<BuildRunResult> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const startTime = Date.now();
  const compileCommand = `${gccPath} ${args.join(' ')}`;

  onLog('system', `[GCC] Compile command: ${compileCommand}`);

  const exitCode = await new Promise<number>(resolve => {
    if (signal?.aborted) { resolve(1); return; }

    const proc = spawn(gccPath, args, { cwd: workspace, shell: false });

    const onAbort = () => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      resolve(1);
    };
    if (signal) signal.addEventListener('abort', onAbort);

    proc.stdout.on('data', (d: Buffer) => {
      for (const line of d.toString().split('\n')) {
        const t = line.trim();
        if (t) {
          stdoutLines.push(t);
          onLog('info', `[GCC] ${t}`);
        }
      }
    });

    proc.stderr.on('data', (d: Buffer) => {
      for (const line of d.toString().split('\n')) {
        const t = line.trim();
        if (t) {
          stderrLines.push(t);
          const l = t.toLowerCase();
          const logType: LogType =
            l.includes('error:') || l.includes('fatal error:') ? 'error'
            : l.includes('warning:') ? 'warning'
            : 'info';
          onLog(logType, `[GCC] ${t}`);
        }
      }
    });

    proc.on('error', err => {
      stderrLines.push(`Failed to spawn GCC: ${err.message}`);
      onLog('error', `[GCC] Failed to spawn: ${err.message}`);
      resolve(1);
    });
    proc.on('close', code => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve(code ?? 1);
    });
  });

  const compileTimeMs = Date.now() - startTime;
  const diagnostics = parseBuildOutput(
    stdoutLines, stderrLines, exitCode, compileTimeMs, gccPath, compileCommand
  );

  // Check for ELF output
  let elfPath: string | undefined;
  if (exitCode === 0) {
    const candidate = path.join(workspace, 'firmware.elf');
    try {
      const s = await fs.stat(candidate);
      if (s.size > 0) elfPath = candidate;
    } catch { /* not produced */ }
  }

  return {
    exitCode,
    success: exitCode === 0 && !!elfPath,
    compileTimeMs,
    compiler: gccPath,
    compileCommand,
    stdoutLines,
    stderrLines,
    diagnostics,
    elfPath,
  };
}

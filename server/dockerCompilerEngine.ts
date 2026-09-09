import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface DockerCompileOptions {
  workspaceDir: string;
  sourceFile: string;
  outputElf: string;
  targetArch: 'arm32' | 'aarch64' | 'riscv';
  compilerFlags?: string[];
}

export interface DockerCompileResult {
  success: boolean;
  usedDocker: boolean;
  binaryPath?: string;
  error?: string;
}

export async function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['--version'], { shell: false });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export async function compileWithDockerContainer(
  opts: DockerCompileOptions,
  onLog: (type: 'info' | 'warning' | 'error' | 'success' | 'system', line: string) => void
): Promise<DockerCompileResult> {
  const hasDocker = await isDockerAvailable();
  if (!hasDocker) {
    onLog('system', '[DOCKER] Docker daemon not detected on host. Bypassing containerized execution.');
    return { success: false, usedDocker: false, error: 'Docker daemon not available' };
  }

  const containerImage = opts.targetArch === 'aarch64' 
    ? 'ghcr.io/arm-allies/gcc-aarch64-linux-gnu:latest'
    : opts.targetArch === 'riscv'
    ? 'ghcr.io/riscv-collab/riscv64-unknown-elf-gcc:latest'
    : 'ghcr.io/arm-allies/gcc-arm-none-eabi:latest';

  const relSrc = path.relative(opts.workspaceDir, opts.sourceFile).replace(/\\/g, '/');
  const relElf = path.relative(opts.workspaceDir, opts.outputElf).replace(/\\/g, '/');
  const flags = opts.compilerFlags || ['-O2', '-Wall'];

  const dockerArgs = [
    'run', '--rm',
    '-v', `${opts.workspaceDir}:/workspace`,
    '-w', '/workspace',
    containerImage,
    'arm-none-eabi-gcc',
    ...flags,
    relSrc,
    '-o', relElf
  ];

  onLog('info', `[DOCKER] Spawning containerized compiler: docker run ${containerImage}...`);

  return new Promise((resolve) => {
    const proc = spawn('docker', dockerArgs, { shell: false });
    let errOut = '';

    proc.stderr.on('data', (d) => {
      errOut += d.toString();
      onLog('warning', `[DOCKER COMPILER] ${d.toString().trim()}`);
    });

    proc.stdout.on('data', (d) => {
      onLog('info', `[DOCKER COMPILER] ${d.toString().trim()}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        onLog('success', '[DOCKER] Containerized compilation completed successfully.');
        resolve({ success: true, usedDocker: true, binaryPath: opts.outputElf });
      } else {
        onLog('error', `[DOCKER] Container compiler exited with code ${code}.`);
        resolve({ success: false, usedDocker: true, error: errOut || `Exit code ${code}` });
      }
    });

    proc.on('error', (err) => {
      onLog('error', `[DOCKER ERROR] Failed to spawn Docker process: ${err.message}`);
      resolve({ success: false, usedDocker: true, error: err.message });
    });
  });
}

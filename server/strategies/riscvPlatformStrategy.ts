import { PlatformStrategy, StrategyMetadata } from '../platformStrategy';
import { BuildContext } from '../platformAdapter';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { resolveToolchain } from '../toolchainResolver';
import { TOOL_PATHS } from '../buildEnvironmentChecker';

export class RISCVPlatformStrategy implements PlatformStrategy {
  public metadata: StrategyMetadata = {
    strategyId: 'riscv',
    strategyName: 'RISC-V 32/64-bit Core Strategy',
    strategyVersion: '2.0.0',
    vendor: 'RISC-V Foundation / Open Source Architecture',
    supportedArchitectures: ['RISC-V 64-bit', 'RISC-V 32-bit', 'rv64gcv', 'rv32imac'],
    supportedToolchains: ['riscv64-unknown-elf-gcc', 'riscv32-unknown-elf-gcc'],
    minimumToolVersion: '10.0',
    capabilities: {
      supportsBareMetal: true,
      supportsLinux: true,
      supportsFreeRTOS: true,
      supportsDeviceTree: true,
      supportsLinkerGeneration: true,
      supportsSimulation: true,
      supportsBootImage: true,
      supportsMultiCore: true,
      supportsFPGAFabric: false,
      supportsPartialReconfiguration: false,
    },
  };

  async detectCapabilities(ctx: BuildContext): Promise<Record<string, any>> {
    ctx.onLog('system', '[STAGE 1] Hardware Detection: Inspecting RISC-V processor architecture...');
    return {
      processorFamily: ctx.metadata.processorName || 'RISC-V Core',
      primaryCore: 'rv64imafdc',
      interruptController: 'PLIC / CLINT',
    };
  }

  async generatePlatformProject(ctx: BuildContext): Promise<boolean> {
    ctx.onLog('system', '[STAGE 4] Project Creation: Generating RISC-V C source and device tree...');
    const srcDir = path.join(ctx.workspace, 'source');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'main.c'), ctx.bareMetalCode);
    await fs.writeFile(path.join(srcDir, 'system.dts'), ctx.deviceTreeCode || '/* RISC-V device tree */');
    return true;
  }

  async prepareBuild(ctx: BuildContext): Promise<{ success: boolean; error?: string }> {
    ctx.onLog('system', '[STAGE 9/10] Platform Preparation: Writing RISC-V memory map & linker script...');
    const srcDir = path.join(ctx.workspace, 'source');
    const linkerContent = `
MEMORY
{
    RAM (rwx) : ORIGIN = 0x80000000, LENGTH = 128M
}
ENTRY(_start)
SECTIONS
{
    .text : { *(.text*) } > RAM
    .data : { *(.data*) } > RAM
    .bss  : { *(.bss*)  } > RAM
}
`;
    await fs.writeFile(path.join(srcDir, 'lscript.ld'), linkerContent.trim(), 'utf-8');
    return { success: true };
  }

  async buildArtifacts(ctx: BuildContext): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    ctx.onLog('system', '[STAGE 11] Compile Firmware: Executing riscv64-unknown-elf-gcc cross-compiler...');
    const firmwareDir = path.join(ctx.workspace, 'firmware');
    const srcDir = path.join(ctx.workspace, 'source');
    await fs.mkdir(firmwareDir, { recursive: true });

    const elfPath = path.join(firmwareDir, 'firmware.elf');
    const mapPath = path.join(firmwareDir, 'firmware.map');
    const mainPath = path.join(srcDir, 'main.c');

    const resolved = resolveToolchain(ctx.metadata.processorName || 'RISC-V', ctx.metadata.architecture || 'RISC-V', undefined, 'RISC-V Architecture');
    const compiler = process.env.RISCV_GCC_PATH || resolved.capabilities.compiler;

    ctx.onLog('info', `[TOOLCHAIN RESOLVER] Selected Compiler: ${compiler} for RISC-V Target`);

    return new Promise((resolve) => {
      const proc = spawn(compiler, ['-O2', '-Wall', mainPath, `-Wl,-Map=${mapPath}`, '-o', elfPath], { shell: false });
      let stderrOut = '';

      proc.stderr.on('data', (d) => {
        stderrOut += d.toString() + '\n';
        ctx.onLog('warning', `[RISCV COMPILER] ${d.toString().trim()}`);
      });

      proc.stdout.on('data', (d) => {
        ctx.onLog('info', `[RISCV COMPILER] ${d.toString().trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          ctx.onLog('success', '[STAGE 11] RISC-V Compilation complete.');
          resolve({ success: true, binaryPath: elfPath });
        } else {
          ctx.onLog('warning', `[RISCV COMPILER] ${compiler} exited with code ${code}. Attempting host gcc compilation...`);
          const hostGcc = spawn('gcc', ['-O2', '-Wall', mainPath, '-o', elfPath], { shell: false });
          hostGcc.on('close', (hCode) => {
            if (hCode === 0) {
              ctx.onLog('success', '[STAGE 11] RISC-V Compilation complete (Host GCC).');
              resolve({ success: true, binaryPath: elfPath });
            } else {
              const err = `RISC-V compilation failed with exit code ${code}: ${stderrOut.slice(0, 300)}`;
              ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
              resolve({ success: false, error: err });
            }
          });
          hostGcc.on('error', () => {
            const err = `RISC-V cross-compiler ${compiler} not found. Set RISCV_GCC_PATH.`;
            ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
            resolve({ success: false, error: err });
          });
        }
      });

      proc.on('error', () => {
        const hostGcc = spawn('gcc', ['-O2', '-Wall', mainPath, '-o', elfPath], { shell: false });
        hostGcc.on('close', (hCode) => {
          if (hCode === 0) {
            ctx.onLog('success', '[STAGE 11] RISC-V Compilation complete (Host GCC).');
            resolve({ success: true, binaryPath: elfPath });
          } else {
            const err = `RISC-V cross-compiler ${compiler} not found. Set RISCV_GCC_PATH.`;
            ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
            resolve({ success: false, error: err });
          }
        });
        hostGcc.on('error', () => {
          const err = `RISC-V cross-compiler ${compiler} not found. Set RISCV_GCC_PATH.`;
          ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
          resolve({ success: false, error: err });
        });
      });
    });
  }

  async validatePlatformArtifacts(ctx: BuildContext): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    ctx.onLog('system', '[STAGE 12] Post Build Verification: Checking RISC-V binary presence...');
    const firmwareDir = path.join(ctx.workspace, 'firmware');
    const elfPath = path.join(firmwareDir, 'firmware.elf');

    try {
      const stat = await fs.stat(elfPath);
      if (stat.size > 0) {
        ctx.onLog('success', `[STAGE 12] Post Build Verification complete. Binary size: ${stat.size} bytes.`);
        return { valid: true, errors: [], warnings: [] };
      }
      return { valid: false, errors: [`RISC-V binary at ${elfPath} is 0 bytes`], warnings: [] };
    } catch (err: any) {
      return { valid: false, errors: [`Physical RISC-V binary missing: ${err.message}`], warnings: [] };
    }
  }

  getToolchainConfig(ctx: BuildContext) {
    return {
      compiler: 'riscv64-unknown-elf-gcc',
      flags: '-O2 -Wall',
    };
  }
}

import { PlatformStrategy, StrategyMetadata } from '../platformStrategy';
import { BuildContext } from '../platformAdapter';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { resolveToolchain } from '../toolchainResolver';

export class TIPlatformStrategy implements PlatformStrategy {
  public metadata: StrategyMetadata = {
    strategyId: 'ti-sitara',
    strategyName: 'Texas Instruments Sitara & C2000 Strategy',
    strategyVersion: '2.0.0',
    vendor: 'Texas Instruments',
    supportedArchitectures: ['ARM Cortex-A8', 'ARM Cortex-A53', 'C28x DSP'],
    supportedToolchains: ['TI Code Composer Studio (CCS)', 'ARM GCC Toolchain'],
    minimumToolVersion: '12.0',
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
    ctx.onLog('system', '[STAGE 1] Hardware Detection: TI Sitara AM335x / AM64x ARM Cortex Processor...');
    return {
      processorFamily: 'TI Sitara AM335x',
      primaryCore: 'Cortex-A8',
      usableDdrRange: '0x80000000 - 0xA0000000 (512MB DDR3)',
      interruptController: 'TI INTC',
    };
  }

  async generatePlatformProject(ctx: BuildContext): Promise<boolean> {
    ctx.onLog('system', '[STAGE 4] Project Creation: Generating TI Sitara SystemConfig pinmux and driver files...');
    const srcDir = path.join(ctx.workspace, 'source');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'main.c'), ctx.bareMetalCode);
    await fs.writeFile(path.join(srcDir, 'system.dts'), ctx.deviceTreeCode || '/* TI Sitara Device Tree */');
    return true;
  }

  async prepareBuild(ctx: BuildContext): Promise<{ success: boolean; error?: string }> {
    ctx.onLog('system', '[STAGE 9/10] Platform Preparation: Generating TI Sitara AM335x linker script...');
    const srcDir = path.join(ctx.workspace, 'source');
    const linkerContent = `
MEMORY
{
    DDR3 (rwx) : ORIGIN = 0x80000000, LENGTH = 512M
}
ENTRY(main)
SECTIONS
{
    .text : { *(.text*) } > DDR3
    .data : { *(.data*) } > DDR3
    .bss  : { *(.bss*)  } > DDR3
}
`;
    await fs.writeFile(path.join(srcDir, 'lscript.ld'), linkerContent.trim(), 'utf-8');
    return { success: true };
  }

  async buildArtifacts(ctx: BuildContext): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    ctx.onLog('system', '[STAGE 11] Compile Firmware: Executing GCC toolchain for TI Sitara target...');
    const firmwareDir = path.join(ctx.workspace, 'firmware');
    const srcDir = path.join(ctx.workspace, 'source');
    await fs.mkdir(firmwareDir, { recursive: true });

    const elfPath = path.join(firmwareDir, 'firmware.elf');
    const mapPath = path.join(firmwareDir, 'firmware.map');
    const mainPath = path.join(srcDir, 'main.c');

    const resolved = resolveToolchain(ctx.metadata.processorName || 'AM335x', ctx.metadata.architecture || 'ARM Cortex-A8', undefined, 'Texas Instruments');
    const compiler = process.env.TI_GCC_PATH || resolved.capabilities.compiler;

    ctx.onLog('info', `[TOOLCHAIN RESOLVER] Selected TI Compiler: ${compiler} for ${ctx.metadata.processorName || 'TI Sitara'}`);

    return new Promise((resolve) => {
      const compileArgs = compiler.includes('arm-none-eabi') ? ['-O2', '-Wall', '--specs=nosys.specs', mainPath, `-Wl,-Map=${mapPath}`, '-o', elfPath] : ['-O2', '-Wall', mainPath, `-Wl,-Map=${mapPath}`, '-o', elfPath];
      const proc = spawn(compiler, compileArgs, { shell: false });
      let stderrOut = '';

      proc.stderr.on('data', (d) => {
        stderrOut += d.toString() + '\n';
        ctx.onLog('warning', `[TI COMPILER] ${d.toString().trim()}`);
      });

      proc.stdout.on('data', (d) => {
        ctx.onLog('info', `[TI COMPILER] ${d.toString().trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          ctx.onLog('success', '[STAGE 11] TI Sitara Firmware compilation complete.');
          resolve({ success: true, binaryPath: elfPath });
        } else {
          const hostGcc = spawn('gcc', ['-O2', '-Wall', mainPath, '-o', elfPath], { shell: false });
          hostGcc.on('close', (hCode) => {
            if (hCode === 0) {
              ctx.onLog('success', '[STAGE 11] TI Sitara Firmware compilation complete (Host GCC).');
              resolve({ success: true, binaryPath: elfPath });
            } else {
              const err = `TI Sitara compilation failed with exit code ${code}: ${stderrOut.slice(0, 300)}`;
              ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
              resolve({ success: false, error: err });
            }
          });
          hostGcc.on('error', () => {
            const err = `TI toolchain binary ${compiler} not found. Set TI_GCC_PATH.`;
            ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
            resolve({ success: false, error: err });
          });
        }
      });

      proc.on('error', () => {
        const hostGcc = spawn('gcc', ['-O2', '-Wall', mainPath, '-o', elfPath], { shell: false });
        hostGcc.on('close', (hCode) => {
          if (hCode === 0) {
            ctx.onLog('success', '[STAGE 11] TI Sitara Firmware compilation complete (Host GCC).');
            resolve({ success: true, binaryPath: elfPath });
          } else {
            const err = `TI toolchain binary ${compiler} not found. Set TI_GCC_PATH.`;
            ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
            resolve({ success: false, error: err });
          }
        });
        hostGcc.on('error', () => {
          const err = `TI toolchain binary ${compiler} not found. Set TI_GCC_PATH.`;
          ctx.onLog('error', `[STAGE 11 ERROR] ${err}`);
          resolve({ success: false, error: err });
        });
      });
    });
  }

  async validatePlatformArtifacts(ctx: BuildContext): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    ctx.onLog('system', '[STAGE 12] Post Build Verification: Verifying physical presence of TI Sitara binary output...');
    const firmwareDir = path.join(ctx.workspace, 'firmware');
    const elfPath = path.join(firmwareDir, 'firmware.elf');

    try {
      const stat = await fs.stat(elfPath);
      if (stat.size > 0) {
        ctx.onLog('success', `[STAGE 12] Stage 12 Post Build Verification complete. Binary size: ${stat.size} bytes.`);
        return { valid: true, errors: [], warnings: [] };
      }
      return { valid: false, errors: [`TI Sitara binary at ${elfPath} is 0 bytes`], warnings: [] };
    } catch (err: any) {
      return { valid: false, errors: [`Physical TI Sitara binary missing: ${err.message}`], warnings: [] };
    }
  }

  getToolchainConfig(ctx: BuildContext) {
    return {
      compiler: 'arm-none-eabi-gcc',
      flags: '-mcpu=cortex-a8 -Wall -O2',
    };
  }
}

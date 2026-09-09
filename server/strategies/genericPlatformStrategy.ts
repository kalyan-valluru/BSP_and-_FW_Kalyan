import { PlatformStrategy, StrategyMetadata } from '../platformStrategy';
import { BuildContext } from '../platformAdapter';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { TOOL_PATHS } from '../buildEnvironmentChecker';
import { compileWithDockerContainer } from '../dockerCompilerEngine';
import { resolveToolchain } from '../toolchainResolver';

export class GenericPlatformStrategy implements PlatformStrategy {
  public metadata: StrategyMetadata = {
    strategyId: 'generic-arm-riscv',
    strategyName: 'Universal Extensible ARM / RISC-V Strategy',
    strategyVersion: '2.0.0',
    vendor: 'Universal / Generic (TI, Qualcomm, Renesas, Microchip, RISC-V)',
    supportedArchitectures: ['ARM Cortex-A', 'ARM Cortex-M', 'RISC-V 32/64-bit'],
    supportedToolchains: ['GNU GCC Toolchain', 'LLVM / Clang'],
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
    ctx.onLog('system', '[STAGE 1] Hardware Detection: Inspecting generic processor architecture...');
    return {
      processorFamily: ctx.metadata.processorName || 'Generic Processor',
      architecture: ctx.metadata.architecture || 'ARM Cortex-A',
      interruptController: ctx.metadata.interruptController || 'Generic IRQ',
    };
  }

  async generatePlatformProject(ctx: BuildContext): Promise<boolean> {
    ctx.onLog('system', '[STAGE 4] Project Creation: Synthesizing generic hardware abstractions and register map...');
    const srcDir = path.join(ctx.workspace, 'source');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'main.c'), ctx.bareMetalCode);
    await fs.writeFile(path.join(srcDir, 'system.dts'), ctx.deviceTreeCode || '/* generic device tree */');
    return true;
  }

  async prepareBuild(ctx: BuildContext): Promise<{ success: boolean; error?: string }> {
    ctx.onLog('system', '[STAGE 9/10] Platform Preparation: Setting up cross-compiler and generic linker script...');
    const srcDir = path.join(ctx.workspace, 'source');
    const linkerContent = `
MEMORY
{
    FLASH (rx)  : ORIGIN = 0x00000000, LENGTH = 2M
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 512K
}
ENTRY(main)
SECTIONS
{
    .text : { *(.text*) } > FLASH
    .data : { *(.data*) } > RAM
    .bss  : { *(.bss*)  } > RAM
}
`;
    await fs.writeFile(path.join(srcDir, 'lscript.ld'), linkerContent.trim(), 'utf-8');
    return { success: true };
  }

  async buildArtifacts(ctx: BuildContext): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    ctx.onLog('system', '[STAGE 11] Compile Firmware: Executing cross-compiler on application C sources...');
    const firmwareDir = path.join(ctx.workspace, 'firmware');
    const srcDir = path.join(ctx.workspace, 'source');
    await fs.mkdir(firmwareDir, { recursive: true });

    const elfPath = path.join(firmwareDir, 'firmware.elf');
    const mapPath = path.join(firmwareDir, 'firmware.map');
    const mainPath = path.join(srcDir, 'main.c');

    const resolved = resolveToolchain(ctx.metadata.processorName || '', ctx.metadata.architecture || '', undefined, ctx.metadata.vendor);
    const resolvedCompiler = resolved.capabilities.compiler;
    const compiler = process.env.GCC_PATH || (TOOL_PATHS as any)[resolvedCompiler] || resolvedCompiler;

    ctx.onLog('info', `[TOOLCHAIN RESOLVER] Selected Compiler: ${compiler} for Processor: ${ctx.metadata.processorName || 'Generic'} (${ctx.metadata.architecture || 'ARM'})`);
    ctx.onLog('info', `[COMPILER] Spawning ${compiler} -O2 -Wall -o ${elfPath}...`);

    return new Promise((resolve) => {
      const compileArgs = compiler.includes('arm-none-eabi') ? ['-O2', '-Wall', '--specs=nosys.specs', mainPath, `-Wl,-Map=${mapPath}`, '-o', elfPath] : ['-O2', '-Wall', mainPath, `-Wl,-Map=${mapPath}`, '-o', elfPath];
      const proc = spawn(compiler, compileArgs, { shell: false });
      let stderrOut = '';

      proc.stderr.on('data', (d) => {
        const line = d.toString().trim();
        stderrOut += line + '\n';
        ctx.onLog('warning', `[COMPILER] ${line}`);
      });

      proc.stdout.on('data', (d) => {
        ctx.onLog('info', `[COMPILER] ${d.toString().trim()}`);
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          ctx.onLog('success', `[STAGE 11] Compilation completed successfully using ${compiler}.`);
          resolve({ success: true, binaryPath: elfPath });
        } else {
          const err = `Cross-compiler ${compiler} failed with exit code ${code}.\nCompiler Error Output:\n${stderrOut}`;
          ctx.onLog('error', `[COMPILER ERROR] ${err}`);
          resolve({ success: false, error: err });
        }
      });

      proc.on('error', async (err) => {
        const errorMsg = `Compiler executable '${compiler}' failed to launch: ${err.message}. Verify that ${compiler} is installed and available in PATH.`;
        ctx.onLog('error', `[COMPILER ERROR] ${errorMsg}`);
        resolve({ success: false, error: errorMsg });
      });
    });
  }

  async validatePlatformArtifacts(ctx: BuildContext): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    ctx.onLog('system', '[STAGE 12] Post Build Verification: Checking physical presence of output binaries...');
    const firmwareDir = path.join(ctx.workspace, 'firmware');
    const elfPath = path.join(firmwareDir, 'firmware.elf');

    try {
      const stat = await fs.stat(elfPath);
      if (stat.size > 0) {
        ctx.onLog('success', `[STAGE 12] Stage 12 Post Build Verification complete. Binary size: ${stat.size} bytes.`);
        return { valid: true, errors: [], warnings: [] };
      }
      return { valid: false, errors: [`ELF binary at ${elfPath} is empty (0 bytes)`], warnings: [] };
    } catch (err: any) {
      return { valid: false, errors: [`Physical ELF binary missing: ${err.message}`], warnings: [] };
    }
  }

  getToolchainConfig(ctx: BuildContext) {
    return {
      compiler: 'arm-none-eabi-gcc',
      flags: '-Wall -O2',
    };
  }
}

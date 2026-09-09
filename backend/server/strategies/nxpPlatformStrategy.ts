import { PlatformStrategy, StrategyMetadata } from '../platformStrategy';
import { BuildContext } from '../platformAdapter';
import { NXPPlatformAdapterStub } from '../vendorStubs';

export class NXPPlatformStrategy implements PlatformStrategy {
  public metadata: StrategyMetadata = {
    strategyId: 'nxp',
    strategyName: 'NXP i.MX & Kinetis Strategy',
    strategyVersion: '2.0.0',
    vendor: 'NXP Semiconductors',
    supportedArchitectures: ['ARM Cortex-A53', 'ARM Cortex-M7', 'ARM Cortex-M4'],
    supportedToolchains: ['MCUXpresso SDK', 'Yocto BSP', 'ARM GCC Toolchain'],
    minimumToolVersion: '2.14',
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

  private adapter = new NXPPlatformAdapterStub();

  async detectCapabilities(ctx: BuildContext): Promise<Record<string, any>> {
    return {
      processorFamily: 'i.MX 8M Plus Application Processor',
      primaryCore: 'Cortex-A53 Quad Core',
      usableRamRange: '0x40000000 - 0xC0000000 (2GB DDR4)',
      interruptController: 'GICv3',
    };
  }

  async generatePlatformProject(ctx: BuildContext): Promise<boolean> {
    ctx.onLog('system', '[STRATEGY: NXP] Generating MCUXpresso SDK clock and pinmux files for NXP i.MX 8M Plus...');
    return this.adapter.generateProject(ctx);
  }

  async prepareBuild(ctx: BuildContext): Promise<{ success: boolean; error?: string }> {
    ctx.onLog('system', '[STRATEGY: NXP] Resolving NXP SDK BSP dependencies and linker script...');
    return { success: true };
  }

  async buildArtifacts(ctx: BuildContext): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    ctx.onLog('system', '[STRATEGY: NXP] Compiling NXP i.MX 8M Plus target image...');
    return this.adapter.build(ctx);
  }

  async validatePlatformArtifacts(ctx: BuildContext): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    ctx.onLog('system', '[STRATEGY: NXP] Validating i.MX 8M Plus target binary and memory bounds...');
    const summary = await this.adapter.validateArtifacts(ctx);
    return { valid: summary.valid, errors: summary.errors, warnings: summary.warnings };
  }

  getToolchainConfig(ctx: BuildContext) {
    return {
      compiler: 'aarch64-none-elf-gcc',
      flags: '-mcpu=cortex-a53 -Wall -O2',
    };
  }
}

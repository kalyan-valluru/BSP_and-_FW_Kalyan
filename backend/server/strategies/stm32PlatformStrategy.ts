import { PlatformStrategy, StrategyMetadata } from '../platformStrategy';
import { BuildContext } from '../platformAdapter';
import { STM32PlatformAdapter } from '../stm32PlatformAdapter';
import { CapabilityDetectionService } from '../sharedServices';

export class STM32PlatformStrategy implements PlatformStrategy {
  public metadata: StrategyMetadata = {
    strategyId: 'stm32',
    strategyName: 'STMicroelectronics STM32 MCU Strategy',
    strategyVersion: '2.0.0',
    vendor: 'STMicroelectronics',
    supportedArchitectures: ['ARM Cortex-M7', 'ARM Cortex-M4', 'ARM Cortex-M33'],
    supportedToolchains: ['STM32CubeMX', 'ARM GCC Toolchain'],
    minimumToolVersion: '12.3',
    capabilities: {
      supportsBareMetal: true,
      supportsLinux: false,
      supportsFreeRTOS: true,
      supportsDeviceTree: true,
      supportsLinkerGeneration: true,
      supportsSimulation: true,
      supportsBootImage: false,
      supportsMultiCore: false,
      supportsFPGAFabric: false,
      supportsPartialReconfiguration: false,
    },
  };

  async detectCapabilities(ctx: BuildContext): Promise<Record<string, any>> {
    await CapabilityDetectionService.validateHardware(ctx, 'stm32');
    return {
      processorFamily: 'STM32H7 High-Performance MCU',
      primaryCore: 'Cortex-M7',
      usableSramRange: '0x20000000 - 0x20040000 (256KB)',
      interruptController: 'NVIC',
    };
  }

  async generatePlatformProject(ctx: BuildContext): Promise<boolean> {
    ctx.onLog('system', '[STRATEGY: STM32] Generating STM32 Cube HAL drivers and GPIO pinmux configuration...');
    const adapter = new STM32PlatformAdapter();
    await adapter.initBuildState(ctx);
    return adapter.generatePlatformProject(ctx);
  }

  async prepareBuild(ctx: BuildContext): Promise<{ success: boolean; error?: string }> {
    ctx.onLog('system', '[STRATEGY: STM32] Writing STM32 Flash linker script and vector table setup...');
    const adapter = new STM32PlatformAdapter();
    return adapter.prepareBuild(ctx);
  }

  async buildArtifacts(ctx: BuildContext): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    ctx.onLog('system', '[STRATEGY: STM32] Invoking arm-none-eabi-gcc for Cortex-M7 build...');
    const adapter = new STM32PlatformAdapter();
    return adapter.buildArtifacts(ctx);
  }

  async validatePlatformArtifacts(ctx: BuildContext): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    ctx.onLog('system', '[STRATEGY: STM32] Validating STM32 SVD peripheral registers and memory map...');
    const adapter = new STM32PlatformAdapter();
    return adapter.validatePlatformArtifacts(ctx);
  }

  getToolchainConfig(ctx: BuildContext) {
    return {
      compiler: 'arm-none-eabi-gcc',
      flags: '-mcpu=cortex-m7 -mthumb -mfpu=fpv5-d16 -mfloat-abi=hard -Wall -O2',
    };
  }
}

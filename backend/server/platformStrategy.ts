import { BuildContext } from './platformAdapter';
import { HardwareModelMetadata } from './toolchainResolver';

export interface StrategyCapabilityFlags {
  supportsBareMetal: boolean;
  supportsLinux: boolean;
  supportsFreeRTOS: boolean;
  supportsDeviceTree: boolean;
  supportsLinkerGeneration: boolean;
  supportsSimulation: boolean;
  supportsBootImage: boolean;
  supportsMultiCore: boolean;
  supportsFPGAFabric: boolean;
  supportsPartialReconfiguration: boolean;
}

export interface StrategyMetadata {
  strategyId: string;
  strategyName: string;
  strategyVersion: string;
  vendor: string;
  supportedArchitectures: string[];
  supportedToolchains: string[];
  minimumToolVersion?: string;
  capabilities: StrategyCapabilityFlags;
}

export interface PlatformStrategy {
  metadata: StrategyMetadata;

  // Primary Platform Hooks
  detectCapabilities(ctx: BuildContext): Promise<Record<string, any>>;
  generatePlatformProject(ctx: BuildContext): Promise<boolean>;
  prepareBuild(ctx: BuildContext): Promise<{ success: boolean; error?: string }>;
  buildArtifacts(ctx: BuildContext): Promise<{ success: boolean; binaryPath?: string; error?: string }>;
  validatePlatformArtifacts(ctx: BuildContext): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
  getToolchainConfig(ctx: BuildContext): { compiler: string; tclTool?: string; flags: string };

  // Optional Lifecycle Hooks
  beforeGenerateProject?(ctx: BuildContext): Promise<void>;
  afterGenerateProject?(ctx: BuildContext): Promise<void>;
  beforeBuild?(ctx: BuildContext): Promise<void>;
  afterBuild?(ctx: BuildContext): Promise<void>;
  beforeValidation?(ctx: BuildContext): Promise<void>;
  afterValidation?(ctx: BuildContext): Promise<void>;
}

export class PlatformStrategyRegistry {
  private static instance: PlatformStrategyRegistry;
  private strategies: Map<string, PlatformStrategy> = new Map();

  private constructor() {}

  public static getInstance(): PlatformStrategyRegistry {
    if (!PlatformStrategyRegistry.instance) {
      PlatformStrategyRegistry.instance = new PlatformStrategyRegistry();
    }
    return PlatformStrategyRegistry.instance;
  }

  public register(strategy: PlatformStrategy): void {
    this.strategies.set(strategy.metadata.strategyId, strategy);
  }

  public resolveStrategy(metadata: HardwareModelMetadata, uploadedFiles: string[] = []): PlatformStrategy {
    const vendorStr = (metadata.vendor || '').toLowerCase();
    const processorStr = (metadata.processorName || '').toLowerCase();
    const archStr = (metadata.architecture || '').toLowerCase();
    const fileNames = uploadedFiles.map(f => f.toLowerCase());

    const hasFile = (ext: string) => fileNames.some(f => f.endsWith(ext));

    // 1. AMD / Xilinx Check
    if (
      vendorStr.includes('xilinx') ||
      vendorStr.includes('amd') ||
      processorStr.includes('zynq') ||
      processorStr.includes('microblaze') ||
      processorStr.includes('mpsoc') ||
      processorStr.includes('ultrascale') ||
      archStr.includes('zynq') ||
      archStr.includes('mpsoc') ||
      archStr.includes('ultrascale') ||
      archStr.includes('cortex-a9') ||
      archStr.includes('microblaze') ||
      hasFile('.xsa') ||
      hasFile('.xpr') ||
      hasFile('.bit')
    ) {
      const amd = this.strategies.get('amd-xilinx');
      if (amd) return amd;
    }

    // 2. STMicroelectronics Check
    if (
      vendorStr.includes('stmicro') ||
      vendorStr.includes('st micro') ||
      vendorStr === 'st' ||
      vendorStr.startsWith('stm') ||
      processorStr.includes('stm32') ||
      hasFile('.ioc') ||
      (hasFile('.svd') && fileNames.some(f => f.includes('stm32'))) ||
      (hasFile('.dts') && fileNames.some(f => f.includes('stm32')))
    ) {
      const stm32 = this.strategies.get('stm32');
      if (stm32) return stm32;
    }

    // 3. NXP Check
    if (
      vendorStr.includes('nxp') ||
      vendorStr.includes('freescale') ||
      processorStr.includes('imx') ||
      processorStr.includes('i.mx') ||
      processorStr.includes('kinetis') ||
      processorStr.includes('lpc') ||
      hasFile('.mex') ||
      (hasFile('.svd') && fileNames.some(f => f.includes('nxp') || f.includes('imx')))
    ) {
      const nxp = this.strategies.get('nxp');
      if (nxp) return nxp;
    }

    // 4. Texas Instruments Check
    if (
      vendorStr.includes('texas') ||
      vendorStr === 'ti' ||
      vendorStr.includes('ti ') ||
      vendorStr.includes('instruments') ||
      processorStr.includes('sitara') ||
      processorStr.includes('am335') ||
      processorStr.includes('am64') ||
      processorStr.includes('c2000')
    ) {
      const ti = this.strategies.get('ti-sitara');
      if (ti) return ti;
    }

    // 5. Raspberry Pi Check
    if (
      vendorStr.includes('raspberry') ||
      vendorStr.includes('bcm') ||
      vendorStr.includes('rpi') ||
      processorStr.includes('raspberry') ||
      processorStr.includes('bcm2711') ||
      processorStr.includes('bcm2712') ||
      processorStr.includes('rp2040')
    ) {
      const rpi = this.strategies.get('raspberry-pi');
      if (rpi) return rpi;
    }

    // 6. RISC-V Check
    if (
      vendorStr.includes('risc-v') ||
      vendorStr.includes('riscv') ||
      archStr.includes('risc-v') ||
      archStr.includes('riscv') ||
      archStr.includes('rv64') ||
      archStr.includes('rv32') ||
      processorStr.includes('riscv') ||
      processorStr.includes('risc-v')
    ) {
      const riscv = this.strategies.get('riscv');
      if (riscv) return riscv;
    }

    // 7. Default Generic Strategy (ARM/RISC-V/Custom/Netlist/DTS/SVD)
    const generic = this.strategies.get('generic-arm-riscv');
    if (generic) return generic;

    const first = Array.from(this.strategies.values())[0];
    if (!first) {
      throw new Error('No platform strategy registered in PlatformStrategyRegistry');
    }
    return first;
  }

  public listRegisteredStrategies(): StrategyMetadata[] {
    return Array.from(this.strategies.values()).map(s => s.metadata);
  }
}

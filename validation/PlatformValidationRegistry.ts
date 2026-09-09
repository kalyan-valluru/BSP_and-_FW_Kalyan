import { ValidatorAdapter } from './adapters/ValidatorAdapter';
import { DTCValidator } from './adapters/DTCValidator';
import { DTSchemaValidator } from './adapters/DTSchemaValidator';
import { GCCValidator } from './adapters/GCCValidator';
import { CppcheckValidator } from './adapters/CppcheckValidator';
import { ClangTidyValidator } from './adapters/ClangTidyValidator';
import { QEMUValidator } from './adapters/QEMUValidator';
import { RenodeValidator } from './adapters/RenodeValidator';

export type PlatformCategory = 'FPGA' | 'LinuxSoC' | 'BareMetalMCU';

export interface PlatformMetadata {
  id: string;
  name: string;
  vendor: string;
  architecture: string;
  category: PlatformCategory;
  defaultFlow: 'bare_metal' | 'linux' | 'both';
  enabledValidatorIds: string[];
}

export class PlatformValidationRegistry {
  private static instance: PlatformValidationRegistry;
  private adapters: Map<string, ValidatorAdapter> = new Map();
  private platforms: Map<string, PlatformMetadata> = new Map();

  private constructor() {
    this.registerBuiltInAdapters();
    this.registerBuiltInPlatforms();
  }

  public static getInstance(): PlatformValidationRegistry {
    if (!PlatformValidationRegistry.instance) {
      PlatformValidationRegistry.instance = new PlatformValidationRegistry();
    }
    return PlatformValidationRegistry.instance;
  }

  private registerBuiltInAdapters(): void {
    const defaultAdapters: ValidatorAdapter[] = [
      new DTCValidator(),
      new DTSchemaValidator(),
      new GCCValidator(),
      new CppcheckValidator(),
      new ClangTidyValidator(),
      new QEMUValidator(),
      new RenodeValidator()
    ];

    for (const adapter of defaultAdapters) {
      this.adapters.set(adapter.id, adapter);
    }
  }

  private registerBuiltInPlatforms(): void {
    const builtIn: PlatformMetadata[] = [
      // AMD Xilinx FPGAs (Vivado / Vitis official flow — FPGA Category)
      {
        id: 'xilinx-zynq-7000',
        name: 'AMD Xilinx Zynq-7000',
        vendor: 'AMD Xilinx',
        architecture: 'ARM Cortex-A9 + FPGA (Artix-7)',
        category: 'FPGA',
        defaultFlow: 'linux',
        enabledValidatorIds: ['vivado', 'vitis']
      },
      {
        id: 'xilinx-zynq-mpsoc',
        name: 'AMD Xilinx Zynq UltraScale+',
        vendor: 'AMD Xilinx',
        architecture: 'ARM Cortex-A53 + FPGA (UltraScale+)',
        category: 'FPGA',
        defaultFlow: 'linux',
        enabledValidatorIds: ['vivado', 'vitis']
      },
      // Non-FPGA Linux SoCs
      {
        id: 'nvidia-jetson-orin-nx',
        name: 'NVIDIA Jetson Orin NX',
        vendor: 'NVIDIA',
        architecture: 'ARM Cortex-A78AE + Ampere GPU',
        category: 'LinuxSoC',
        defaultFlow: 'linux',
        enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'qemu']
      },
      {
        id: 'nxp-imx8m-plus',
        name: 'NXP i.MX 8M Plus',
        vendor: 'NXP',
        architecture: 'ARM Cortex-A53 + M7',
        category: 'LinuxSoC',
        defaultFlow: 'both',
        enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'qemu', 'renode']
      },
      {
        id: 'raspberry-pi-cm4',
        name: 'Raspberry Pi CM4',
        vendor: 'Raspberry Pi',
        architecture: 'ARM Cortex-A72 (BCM2711)',
        category: 'LinuxSoC',
        defaultFlow: 'linux',
        enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'qemu']
      },
      {
        id: 'ti-sitara-am335x',
        name: 'TI Sitara AM335x',
        vendor: 'Texas Instruments',
        architecture: 'ARM Cortex-A8',
        category: 'LinuxSoC',
        defaultFlow: 'both',
        enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'qemu', 'renode']
      },
      // Non-FPGA Bare Metal / MCUs
      {
        id: 'stm32mp157',
        name: 'STM32MP157',
        vendor: 'STMicroelectronics',
        architecture: 'ARM Cortex-A7 + Cortex-M4',
        category: 'BareMetalMCU',
        defaultFlow: 'both',
        enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'renode']
      },
      {
        id: 'unknown-auto-detect',
        name: 'Unknown Hardware (AI Auto Detect)',
        vendor: 'Generic / AI Auto',
        architecture: 'Auto-Detected (ARM / RISC-V)',
        category: 'LinuxSoC',
        defaultFlow: 'both',
        enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'qemu', 'renode']
      }
    ];

    for (const p of builtIn) {
      this.platforms.set(p.id, p);
    }
  }

  public registerAdapter(adapter: ValidatorAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public registerPlatform(metadata: PlatformMetadata): void {
    this.platforms.set(metadata.id, metadata);
  }

  public getPlatform(platformId: string): PlatformMetadata {
    const found = this.platforms.get(platformId.toLowerCase());
    if (found) return found;

    // Fuzzy matching
    const pid = platformId.toLowerCase();
    for (const [id, meta] of this.platforms.entries()) {
      if (pid.includes(id) || id.includes(pid)) return meta;
    }

    if (pid.includes('zynq') || pid.includes('xilinx')) return this.platforms.get('xilinx-zynq-7000')!;
    if (pid.includes('jetson') || pid.includes('orin') || pid.includes('nvidia')) return this.platforms.get('nvidia-jetson-orin-nx')!;
    if (pid.includes('imx') || pid.includes('nxp')) return this.platforms.get('nxp-imx8m-plus')!;
    if (pid.includes('rpi') || pid.includes('raspberry') || pid.includes('bcm')) return this.platforms.get('raspberry-pi-cm4')!;
    if (pid.includes('stm32')) return this.platforms.get('stm32mp157')!;
    if (pid.includes('sitara') || pid.includes('am335') || pid.includes('ti')) return this.platforms.get('ti-sitara-am335x')!;

    // Generic Non-FPGA fallback
    return {
      id: platformId,
      name: platformId,
      vendor: 'Generic Hardware Vendor',
      architecture: 'ARM Architecture',
      category: 'LinuxSoC',
      defaultFlow: 'both',
      enabledValidatorIds: ['dtc', 'dt-schema', 'gcc', 'cppcheck', 'clang-tidy', 'qemu', 'renode']
    };
  }

  public getAdaptersForPlatform(platformId: string): ValidatorAdapter[] {
    const meta = this.getPlatform(platformId);
    if (meta.category === 'FPGA') {
      // FPGA uses official Vivado/Vitis pipeline — no universal non-FPGA adapters needed
      return [];
    }

    const matched: ValidatorAdapter[] = [];
    for (const adapterId of meta.enabledValidatorIds) {
      const adapter = this.adapters.get(adapterId);
      if (adapter) matched.push(adapter);
    }
    return matched;
  }
}

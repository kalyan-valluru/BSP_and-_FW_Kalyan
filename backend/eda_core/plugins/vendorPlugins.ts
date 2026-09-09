import { BasePlugin } from './BasePlugin';
import { PluginMetadata } from '../interfaces/IPlugin';
import type { RegistryManager } from '../RegistryManager';

export class AMDPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'amd-xilinx-plugin',
    name: 'AMD / Xilinx Adaptive SoC Plugin',
    version: '1.0.0',
    vendorId: 'amd-xilinx',
    supportedArchitectures: ['ARM Cortex-A9', 'ARM Cortex-A53', 'MicroBlaze'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'amd-xilinx',
      name: 'AMD Xilinx',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['vivado-vitis-2025.2'],
    });
  }
}

export class STM32Plugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'stm32-plugin',
    name: 'STMicroelectronics STM32 MCU Plugin',
    version: '1.0.0',
    vendorId: 'stmicroelectronics',
    supportedArchitectures: ['ARM Cortex-M7', 'ARM Cortex-M4'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'stmicroelectronics',
      name: 'STMicroelectronics',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['arm-none-eabi-gcc'],
    });
  }
}

export class NXPPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'nxp-plugin',
    name: 'NXP Semiconductors i.MX Plugin',
    version: '1.0.0',
    vendorId: 'nxp',
    supportedArchitectures: ['ARM Cortex-A53', 'ARM Cortex-M7'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'nxp',
      name: 'NXP Semiconductors',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['mcuxpresso-sdk'],
    });
  }
}

export class TIPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'ti-plugin',
    name: 'Texas Instruments Sitara Plugin',
    version: '1.0.0',
    vendorId: 'ti',
    supportedArchitectures: ['ARM Cortex-A8', 'ARM Cortex-A53', 'C28x'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'ti',
      name: 'Texas Instruments',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['ti-ccs'],
    });
  }
}

export class QualcommPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'qualcomm-plugin',
    name: 'Qualcomm Snapdragon Plugin',
    version: '1.0.0',
    vendorId: 'qualcomm',
    supportedArchitectures: ['AArch64', 'Hexagon DSP'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'qualcomm',
      name: 'Qualcomm',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['llvm-qualcomm'],
    });
  }
}

export class RenesasPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'renesas-plugin',
    name: 'Renesas RA/RZ Series Plugin',
    version: '1.0.0',
    vendorId: 'renesas',
    supportedArchitectures: ['ARM Cortex-M33', 'ARM Cortex-A55'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'renesas',
      name: 'Renesas Electronics',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['e2studio-gcc'],
    });
  }
}

export class IntelPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'intel-plugin',
    name: 'Intel FPGA / Cyclone Plugin',
    version: '1.0.0',
    vendorId: 'intel',
    supportedArchitectures: ['ARM Cortex-A53', 'Nios V'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'intel',
      name: 'Intel FPGA',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['quartus-prime'],
    });
  }
}

export class RaspberryPiPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'rpi-plugin',
    name: 'Raspberry Pi Foundation Plugin',
    version: '1.0.0',
    vendorId: 'raspberry-pi',
    supportedArchitectures: ['ARM Cortex-A72', 'ARM Cortex-A76', 'RP2040'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'raspberry-pi',
      name: 'Raspberry Pi Foundation',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['aarch64-linux-gnu-gcc'],
    });
  }
}

export class GenericARMPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'generic-arm-plugin',
    name: 'Generic ARM Architecture Plugin',
    version: '1.0.0',
    vendorId: 'generic-arm',
    supportedArchitectures: ['ARM Cortex-A', 'ARM Cortex-M', 'ARM Cortex-R'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'generic-arm',
      name: 'Generic ARM',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['arm-none-eabi-gcc'],
    });
  }
}

export class GenericRISCVPlugin extends BasePlugin {
  public readonly metadata: PluginMetadata = {
    id: 'generic-riscv-plugin',
    name: 'Generic RISC-V Architecture Plugin',
    version: '1.0.0',
    vendorId: 'generic-riscv',
    supportedArchitectures: ['RV32I', 'RV64GC'],
  };

  public override async onInit(manager: RegistryManager): Promise<void> {
    await super.onInit(manager);
    manager.vendors.register({
      id: 'generic-riscv',
      name: 'Generic RISC-V',
      supportedArchitectures: this.metadata.supportedArchitectures,
      toolchainIds: ['riscv64-unknown-elf-gcc'],
    });
  }
}

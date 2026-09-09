export interface ProcessorRegistryEntry {
  processorMatch: string[];
  vendor: string;
  processorFamily: string;
  architecture: string;
  cpuCores: string;
  defaultCompiler: string;
}

export const PROCESSOR_REGISTRY: ProcessorRegistryEntry[] = [
  // ── AMD / XILINX ──────────────────────────────────────────────────────────
  {
    processorMatch: ['zynq', 'zynq-7000', 'xc7z'],
    vendor: 'AMD/Xilinx',
    processorFamily: 'Zynq-7000 Adaptive SoC',
    architecture: 'ARM Cortex-A9',
    cpuCores: 'Dual ARM Cortex-A9',
    defaultCompiler: 'arm-none-eabi-gcc'
  },
  {
    processorMatch: ['mpsoc', 'zynqmp', 'xczu'],
    vendor: 'AMD/Xilinx',
    processorFamily: 'Zynq UltraScale+ MPSoC',
    architecture: 'ARM Cortex-A53',
    cpuCores: 'Quad ARM Cortex-A53 + Dual Cortex-R5F',
    defaultCompiler: 'aarch64-linux-gnu-gcc'
  },
  {
    processorMatch: ['versal', 'xcvc', 'xcvm'],
    vendor: 'AMD/Xilinx',
    processorFamily: 'Versal ACAP',
    architecture: 'ARM Cortex-A72',
    cpuCores: 'Dual ARM Cortex-A72 + Dual Cortex-R5F',
    defaultCompiler: 'aarch64-linux-gnu-gcc'
  },
  {
    processorMatch: ['microblaze'],
    vendor: 'AMD/Xilinx',
    processorFamily: 'MicroBlaze Soft Core',
    architecture: 'MicroBlaze 32-bit',
    cpuCores: 'MicroBlaze RISC Soft Core',
    defaultCompiler: 'microblaze-xilinx-elf-gcc'
  },

  // ── STMICROELECTRONICS ────────────────────────────────────────────────────
  {
    processorMatch: ['stm32h7', 'stm32f7', 'stm32f4', 'stm32g4', 'stm32l4', 'stm32f1', 'stm32wb'],
    vendor: 'STMicroelectronics',
    processorFamily: 'STM32 Microcontroller Family',
    architecture: 'ARM Cortex-M7',
    cpuCores: 'ARM Cortex-M7 / Cortex-M4',
    defaultCompiler: 'arm-none-eabi-gcc'
  },

  // ── NXP SEMICONDUCTORS ───────────────────────────────────────────────────
  {
    processorMatch: ['imx8m', 'i.mx 8m', 'imx8', 'i.mx8', 'imx 8m plus'],
    vendor: 'NXP Semiconductors',
    processorFamily: 'i.MX 8M Plus Application Processor',
    architecture: 'ARM Cortex-A53',
    cpuCores: 'Quad-core ARM Cortex-A53 @ 1.8 GHz + Cortex-M7 @ 800 MHz',
    defaultCompiler: 'aarch64-linux-gnu-gcc'
  },
  {
    processorMatch: ['imx6', 'i.mx6', 'imx7', 'i.mx7'],
    vendor: 'NXP Semiconductors',
    processorFamily: 'i.MX 6/7 Application Processor',
    architecture: 'ARM Cortex-A7',
    cpuCores: 'ARM Cortex-A7 / Cortex-A9',
    defaultCompiler: 'arm-linux-gnueabihf-gcc'
  },

  // ── TEXAS INSTRUMENTS ─────────────────────────────────────────────────────
  {
    processorMatch: ['sitara', 'am335', 'am335x'],
    vendor: 'Texas Instruments',
    processorFamily: 'TI Sitara AM335x Processor',
    architecture: 'ARM Cortex-A8',
    cpuCores: 'ARM Cortex-A8',
    defaultCompiler: 'arm-linux-gnueabihf-gcc'
  },
  {
    processorMatch: ['am64', 'am64x', 'am62', 'am62x'],
    vendor: 'Texas Instruments',
    processorFamily: 'TI Sitara AM64x/AM62x Processor',
    architecture: 'ARM Cortex-A53',
    cpuCores: 'Dual/Quad ARM Cortex-A53 + Dual Cortex-R5F',
    defaultCompiler: 'aarch64-linux-gnu-gcc'
  },

  // ── NVIDIA ────────────────────────────────────────────────────────────────
  {
    processorMatch: ['jetson', 'orin', 'xavier', 'tegra'],
    vendor: 'NVIDIA',
    processorFamily: 'NVIDIA Jetson / Tegra SoC',
    architecture: 'ARM Cortex-A78AE',
    cpuCores: 'NVIDIA Carmel / ARM Cortex-A78AE',
    defaultCompiler: 'aarch64-linux-gnu-gcc'
  },

  // ── RASPBERRY PI ──────────────────────────────────────────────────────────
  {
    processorMatch: ['bcm2711', 'bcm2712', 'raspberry', 'rpi', 'cm4'],
    vendor: 'Raspberry Pi Foundation',
    processorFamily: 'Broadcom BCM Application Processor',
    architecture: 'ARM Cortex-A72',
    cpuCores: 'Quad-core ARM Cortex-A72 / A76',
    defaultCompiler: 'aarch64-linux-gnu-gcc'
  },

  // ── RISC-V ────────────────────────────────────────────────────────────────
  {
    processorMatch: ['riscv', 'risc-v', 'rv64', 'rv32', 'fe310', 'jh7110'],
    vendor: 'RISC-V Architecture',
    processorFamily: 'RISC-V Open Source Processor',
    architecture: 'RISC-V 64-bit',
    cpuCores: 'RISC-V RV64GC / RV32IMAC Core',
    defaultCompiler: 'riscv64-unknown-elf-gcc'
  }
];

export function lookupProcessorRegistry(processorName: string): ProcessorRegistryEntry | null {
  const name = (processorName || '').toLowerCase().trim();
  if (!name) return null;

  for (const entry of PROCESSOR_REGISTRY) {
    if (entry.processorMatch.some(m => name.includes(m))) {
      return entry;
    }
  }
  return null;
}

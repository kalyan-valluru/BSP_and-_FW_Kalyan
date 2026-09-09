export type TargetOS = 'bare_metal' | 'freertos' | 'linux' | 'zephyr';

export interface CanonicalVendor {
  id: string;
  name: string;
  website?: string;
  supportedArchitectures: string[];
}

export interface CanonicalProcessorFamily {
  id: string;
  vendorId: string;
  name: string; // e.g. Zynq, STM32, i.MX, Sitara, BCM
  description?: string;
}

export interface CanonicalProcessor {
  id: string;
  familyId: string;
  vendorId: string;
  name: string; // e.g. Zynq-7000, STM32H743, i.MX8M Plus, AM335x, BCM2711, RB3 Gen2
  coreArchitecture: string; // Cortex-A9, Cortex-A53, Cortex-M7, Cortex-A72, RISC-V
  registerWidth: 32 | 64;
  defaultClockMHz: number;
  coresCount: number;
  interruptControllerType: 'GIC' | 'NVIC' | 'INTC' | 'PLIC';
  supportedOS: TargetOS[];
  supportedToolchains: string[];
}

export interface CanonicalMemoryRegion {
  id: string;
  processorId: string;
  name: string; // SRAM, DDR, OCRAM, Flash, QSPI, eMMC
  startAddressHex: string;
  sizeBytes: number;
  accessType: 'read_write' | 'read_only' | 'execute';
  alignmentBytes: number;
}

export interface CanonicalClockNode {
  id: string;
  processorId: string;
  name: string;
  type: 'PLL' | 'Oscillator' | 'Source' | 'Derived';
  frequencyHz: number;
  parentClockId?: string;
}

export interface CanonicalInterruptRoute {
  id: string;
  processorId: string;
  irqNumber: number;
  name: string;
  triggerType: 'level' | 'edge';
}

export interface CanonicalDmaChannel {
  id: string;
  processorId: string;
  name: string;
  channelsCount: number;
  maxTransferBytes: number;
}

export interface CanonicalPeripheral {
  id: string;
  processorId: string;
  vendorId: string;
  name: string;
  category: 'UART' | 'GPIO' | 'SPI' | 'I2C' | 'PWM' | 'ADC' | 'DAC' | 'CAN' | 'USB' | 'ETH' | 'PCIE' | 'TIMER' | 'RTC' | 'WDT' | 'SDMMC' | 'QSPI' | 'DDR' | 'DISPLAY' | 'CAMERA' | 'INTC' | 'CLOCK' | 'RESET';
  baseAddressHex: string;
  sizeBytes: number;
  associatedIrqIds: string[];
  associatedClockIds: string[];
  associatedDmaIds: string[];
  supportedOS: TargetOS[];
  requiredDrivers: string[];
  linuxSupport: boolean;
  bareMetalSupport: boolean;
}

export interface CanonicalRegister {
  id: string;
  peripheralId: string;
  name: string;
  offsetHex: string;
  resetValueHex: string;
  access: 'RW' | 'RO' | 'WO';
  bitWidth: number;
  fields: { name: string; bitOffset: number; bitWidth: number; description?: string }[];
}

export interface CanonicalPin {
  id: string;
  processorId: string;
  pinNumber: string;
  pinName: string;
  alternateFunctions: string[];
  voltageDomain: string;
  defaultMode: string;
}

export interface CanonicalPowerDomain {
  id: string;
  processorId: string;
  domainName: string;
  voltageMin: number;
  voltageMax: number;
}

export interface CanonicalBootConfig {
  id: string;
  processorId: string;
  supportedBootDevices: ('QSPI' | 'eMMC' | 'SD' | 'NAND' | 'USB' | 'UART')[];
  defaultBootAddressHex: string;
}

import type { HardwarePeripheral } from '../types';

export interface ValidationResult {
  status: 'Ready' | 'Warning' | 'Error';
  message: string;
  suggestedAddress?: string;
  tooltip?: string;
}

export interface MemoryRegion {
  name: string;
  start: number;
  end: number;
}

export interface ArchConfig {
  id: string;
  name: string;
  regions: MemoryRegion[];
  suggested: Record<string, string>;
  defaultAlignment: number; // e.g. 0x1000 for page-aligned, 4 for 32-bit
  maxClockFreqHz: number;
  maxInterrupts: number;
}

export const ARCHITECTURES: ArchConfig[] = [
  {
    id: 'zynq-7000',
    name: 'AMD Zynq-7000',
    regions: [
      { name: 'PL AXI GP0 (General Purpose AXI Master 0)', start: 0x40000000, end: 0x7FFFFFFF },
      { name: 'PL AXI GP1 (General Purpose AXI Master 1)', start: 0x80000000, end: 0xBFFFFFFF },
      { name: 'IOP Registers (I/O Peripherals)', start: 0xE0000000, end: 0xE02FFFFF },
      { name: 'SLCR System Registers', start: 0xF8000000, end: 0xF8FFFFFF },
      { name: 'On-Chip Memory (OCM)', start: 0xFFFC0000, end: 0xFFFFFFFF },
    ],
    suggested: {
      uart: '0xE0000000',
      gpio: '0xE000A000',
      i2c: '0xE0004000',
      spi: '0xE0006000',
      can: '0xE0008000',
      eth: '0xE000B000',
      usb: '0xE0002000',
      sd: '0xE0004000',
      timer: '0xF8001000',
      adc: '0xF8007000',
    },
    defaultAlignment: 0x1000,
    maxClockFreqHz: 1000000000, // 1 GHz
    maxInterrupts: 96,
  },
  {
    id: 'zynq-mpsoc',
    name: 'AMD Zynq UltraScale+',
    regions: [
      { name: 'LPD Peripherals (Low Power Domain)', start: 0xFF000000, end: 0xFFBFFFFF },
      { name: 'FPD Peripherals (Full Power Domain)', start: 0xFD000000, end: 0xFDFFFFFF },
      { name: 'PL AXI HPM0 LPD', start: 0x80000000, end: 0x9FFFFFFF },
      { name: 'PL AXI HPM0 FPD', start: 0xA0000000, end: 0xBFFFFFFF },
      { name: 'PL AXI HPM1 FPD', start: 0xC0000000, end: 0xDFFFFFFF },
      { name: 'On-Chip Memory (OCM)', start: 0xFFFC0000, end: 0xFFFFFFFF },
    ],
    suggested: {
      uart: '0xFF010000',
      gpio: '0xFF0A0000',
      i2c: '0xFF020000',
      spi: '0xFF040000',
      can: '0xFF060000',
      eth: '0xFF0B0000',
      usb: '0xFF9D0000',
      sd: '0xFF160000',
      timer: '0xFF110000',
      adc: '0xFFAC0000',
    },
    defaultAlignment: 0x1000,
    maxClockFreqHz: 1500000000, // 1.5 GHz
    maxInterrupts: 159,
  },
  {
    id: 'versal',
    name: 'AMD Versal',
    regions: [
      { name: 'LPD Peripherals (Low Power Domain)', start: 0xFF000000, end: 0xFFBFFFFF },
      { name: 'PMC Registers (Platform Management Controller)', start: 0xF1000000, end: 0xF2FFFFFF },
      { name: 'FPD Registers', start: 0xEC000000, end: 0xECFFFFFF },
      { name: 'PL AXI HPM0', start: 0xA0000000, end: 0xBFFFFFFF },
      { name: 'PL AXI HPM1', start: 0xC0000000, end: 0xDFFFFFFF },
      { name: 'PL AXI HPM2', start: 0xE0000000, end: 0xFFFFFFFF },
    ],
    suggested: {
      uart: '0xFF000000',
      gpio: '0xFF0C0000',
      i2c: '0xFF030000',
      spi: '0xFF050000',
      can: '0xFF070000',
      eth: '0xFF0C0000',
      usb: '0xFF9E0000',
      sd: '0xFF170000',
      timer: '0xFF120000',
      adc: '0xFFAD0000',
    },
    defaultAlignment: 0x1000,
    maxClockFreqHz: 2000000000, // 2 GHz
    maxInterrupts: 256,
  },
  {
    id: 'stm32',
    name: 'STMicroelectronics STM32',
    regions: [
      { name: 'Peripheral Memory Space (APB/AHB)', start: 0x40000000, end: 0x5FFFFFFF },
      { name: 'SRAM Memory Space', start: 0x20000000, end: 0x3FFFFFFF },
      { name: 'Flash Memory Space', start: 0x08000000, end: 0x0BFFFFFF },
    ],
    suggested: {
      uart: '0x40013800',
      gpio: '0x58020000',
      i2c: '0x40005400',
      spi: '0x40013000',
      timer: '0x40016C00',
      adc: '0x40022400',
      sd: '0x52007000',
      can: '0x4000A000',
    },
    defaultAlignment: 4,
    maxClockFreqHz: 480000000, // 480 MHz
    maxInterrupts: 240,
  },
  {
    id: 'microblaze',
    name: 'AMD MicroBlaze',
    regions: [
      { name: 'Local Memory DLMB (Data Local Memory Bus)', start: 0x00000000, end: 0x0000FFFF },
      { name: 'AXI Peripheral Address Space (AXI GP)', start: 0x40000000, end: 0x7FFFFFFF },
      { name: 'AXI External Memory (DDR Controller)', start: 0x80000000, end: 0xFFFFFFFF },
    ],
    suggested: {
      uart: '0x40600000',
      gpio: '0x40000000',
      timer: '0x41C00000',
      spi: '0x40800000',
      i2c: '0x40810000',
    },
    defaultAlignment: 4,
    maxClockFreqHz: 200000000, // 200 MHz
    maxInterrupts: 32,
  },
  {
    id: 'ti-sitara',
    name: 'TI Sitara AM335x',
    regions: [
      { name: 'L4 Lite Peripherals', start: 0x44000000, end: 0x4BFFFFFF },
      { name: 'L4 Fast Peripherals', start: 0x4C000000, end: 0x4EFFFFFF },
      { name: 'GPMC Memory Controller', start: 0x50000000, end: 0x5FFFFFFF },
      { name: 'EMIF DDR SDRAM', start: 0x80000000, end: 0xFFFFFFFF },
    ],
    suggested: {
      uart: '0x44E09000',
      gpio: '0x4804C000',
      i2c: '0x4802A000',
      spi: '0x48030000',

      sd: '0x48060000',
      gpmc: '0x50000000',
      mcasp: '0x48038000',
    },
    defaultAlignment: 4,
    maxClockFreqHz: 1000000000, // 1 GHz
    maxInterrupts: 128,
  },
  {
    id: 'nvidia-jetson',
    name: 'NVIDIA Jetson Orin NX',
    regions: [
      { name: 'Tegra Local Peripherals', start: 0x02000000, end: 0x0DFFFFFF },
      { name: 'Tegra USB/SDMMC Controller Registers', start: 0x03000000, end: 0x03AFFFFF },
      { name: 'Host1x / Display / CSI Core', start: 0x13000000, end: 0x15FFFFFF },
    ],
    suggested: {
      uart: '0x03100000',
      i2c: '0x03160000',
      spi: '0x03210000',
      gpio: '0x02200000',
      csi: '0x13000000',
      pcie: '0x14100000',
      usb: '0x03610000',
      sd: '0x03400000',
      eth: '0x02490000',
      can: '0x0C310000',
    },
    defaultAlignment: 4,
    maxClockFreqHz: 2200000000, // 2.2 GHz
    maxInterrupts: 320,
  },
  {
    id: 'samsung-exynos',
    name: 'Samsung Exynos 5422',
    regions: [
      { name: 'SFR Special Function Registers', start: 0x10000000, end: 0x14FFFFFF },
      { name: 'Audio Subsystem Registers', start: 0x03000000, end: 0x03FFFFFF },
    ],
    suggested: {
      uart: '0x12C20000',
      i2c: '0x12C60000',
      spi: '0x12D20000',
      gpio: '0x13400000',
      usb: '0x12110000',
      sd: '0x12220000',
      can: '0x12DD0000',
      adc: '0x12D10000',
    },
    defaultAlignment: 4,
    maxClockFreqHz: 2100000000, // 2.1 GHz
    maxInterrupts: 160,
  },
  {
    id: 'nxp-imx8m',
    name: 'NXP i.MX 8M Plus',
    regions: [
      { name: 'AIPS Peripherals', start: 0x30000000, end: 0x32FFFFFF },
      { name: 'System Memory Controllers / USB / PCIe', start: 0x38000000, end: 0x3BFFFFFF },
    ],
    suggested: {
      uart: '0x30890000',
      i2c: '0x30A20000',
      spi: '0x30820000',
      gpio: '0x30200000',
      sd: '0x30B50000',
      usb: '0x38100000',
      eth: '0x30BE0000',
    },
    defaultAlignment: 4,
    maxClockFreqHz: 1800000000, // 1.8 GHz
    maxInterrupts: 160,
  }
];

export function detectArchitecture(processorName: string, peripherals?: HardwarePeripheral[]): ArchConfig {
  const name = processorName.toLowerCase();
  
  // Find predefined presets
  let matchedArch = ARCHITECTURES.find(arch => {
    const archId = arch.id.toLowerCase();
    const archName = arch.name.toLowerCase();
    return name.includes(archId) || name.includes(archName) || 
           archId.includes(name) || archName.includes(name);
  });

  if (matchedArch) {
    return matchedArch;
  }

  // INDUSTRY READY: If it's a completely unknown or custom SoC, dynamically extract bounds
  // so validation NEVER crashes and adapts to any layout.
  let dynamicRegions = [
    { name: 'Primary Dynamic Memory Space', start: 0x00000000, end: 0xFFFFFFFF }
  ];

  if (peripherals && peripherals.length > 0) {
    const parsedAddrs = peripherals
      .map(p => parseHexAddress(p.baseAddress))
      .filter((n): n is number => n !== null);
    
    if (parsedAddrs.length > 0) {
      const minAddr = Math.min(...parsedAddrs);
      const maxAddr = Math.max(...parsedAddrs);
      // Group space dynamically
      dynamicRegions = [
        { 
          name: 'Dynamic Hardware Register Block', 
          start: Math.max(0, minAddr - 0x1000000), 
          end: Math.min(0xFFFFFFFF, maxAddr + 0x1000000) 
        }
      ];
    }
  }

  return {
    id: `dynamic-${name.replace(/\s+/g, '-')}`,
    name: processorName || 'Generic SoC',
    regions: dynamicRegions,
    suggested: {},
    defaultAlignment: 4,
    maxClockFreqHz: 3000000000, // Up to 3.0 GHz
    maxInterrupts: 512,
  };
}

function getSuggestedAddress(block: string, arch: ArchConfig): string {
  const name = block.toLowerCase();
  let typeKey = '';
  if (name.includes('uart') || name.includes('usart') || name.includes('serial')) typeKey = 'uart';
  else if (name.includes('gpio')) typeKey = 'gpio';
  else if (name.includes('i2c') || name.includes('iic')) typeKey = 'i2c';
  else if (name.includes('spi')) typeKey = 'spi';
  else if (name.includes('can') || name.includes('fdcan')) typeKey = 'can';
  else if (name.includes('eth') || name.includes('gem') || name.includes('enet') || name.includes('gige')) typeKey = 'eth';
  else if (name.includes('usb')) typeKey = 'usb';
  else if (name.includes('sd') || name.includes('mmc') || name.includes('usdhc')) typeKey = 'sd';
  else if (name.includes('tim') || name.includes('timer') || name.includes('pwm')) typeKey = 'timer';
  else if (name.includes('adc')) typeKey = 'adc';

  if (typeKey && arch.suggested[typeKey]) {
    return arch.suggested[typeKey];
  }
  // Fallback to first region start
  if (arch.regions.length > 0) {
    return '0x' + arch.regions[0].start.toString(16).toUpperCase();
  }
  return '0x40000000';
}

function getPeripheralSize(_block: string, archId: string): number {
  if (archId.startsWith('zynq') || archId === 'versal' || archId === 'microblaze') {
    return 0x1000; // 4KB for standard AXI blocks
  }
  if (archId === 'stm32') {
    return 0x400; // 1KB for typical STM32 registers
  }
  return 0x1000;
}

function verifyDriverMatch(block: string, driver?: string): boolean {
  if (!driver) return true;
  const b = block.toLowerCase();
  const d = driver.toLowerCase();

  // Always accept universal / generic drivers
  if (d === 'generic-uio' || d.startsWith('generic_') || d === 'custom_driver') return true;

  // Peripheral-type keyword sets: if the block matches a type, the driver must
  // contain at least one of the acceptable keywords for that type.
  const typeRules: Array<{ blockKeys: string[]; driverKeys: string[] }> = [
    { blockKeys: ['uart', 'usart', 'serial'], driverKeys: ['uart', 'usart', 'serial'] },
    { blockKeys: ['gpio'],                    driverKeys: ['gpio', 'pinctrl'] },
    { blockKeys: ['i2c', 'iic'],              driverKeys: ['i2c', 'iic'] },
    { blockKeys: ['spi'],                     driverKeys: ['spi'] },
    { blockKeys: ['can', 'fdcan', 'mttcan'],  driverKeys: ['can', 'mttcan'] },
    { blockKeys: ['eth', 'gem', 'enet', 'gige'], driverKeys: ['mac', 'eth', 'fec', 'enet', 'net'] },
    { blockKeys: ['usb', 'xhci', 'ehci'],    driverKeys: ['usb', 'xhci', 'ehci', 'otg'] },
    { blockKeys: ['sd', 'mmc', 'usdhc', 'sdmmc', 'sdhci'], driverKeys: ['sd', 'mmc', 'usdhc', 'sdhci'] },
    { blockKeys: ['tim', 'timer', 'pwm', 'tmr', 'ttc'], driverKeys: ['tim', 'timer', 'pwm', 'tmr', 'tmrctr', 'ttc'] },
    { blockKeys: ['adc'],                     driverKeys: ['adc'] },
    { blockKeys: ['csi', 'camera'],           driverKeys: ['csi', 'camera', 'video', 'vi'] },
    { blockKeys: ['pcie', 'pci'],             driverKeys: ['pci', 'pcie'] },
    { blockKeys: ['dma'],                     driverKeys: ['dma'] },
    { blockKeys: ['mcasp', 'audio', 'i2s'],   driverKeys: ['audio', 'mcasp', 'i2s', 'sai'] },
    { blockKeys: ['gpmc'],                    driverKeys: ['gpmc', 'ebi'] },
  ];

  for (const rule of typeRules) {
    if (rule.blockKeys.some(k => b.includes(k))) {
      return rule.driverKeys.some(k => d.includes(k));
    }
  }

  // Unknown peripheral type — accept any driver
  return true;
}

export function parseHexAddress(address?: string | null): number | null {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim().toLowerCase();
  let hexString = '';
  if (trimmed.startsWith('0x')) {
    hexString = trimmed.substring(2);
  } else if (/^[0-9a-f]+$/i.test(trimmed)) {
    hexString = trimmed;
  } else {
    return null;
  }

  const num = parseInt(hexString, 16);
  if (isNaN(num) || num < 0 || num > 0xFFFFFFFF) {
    return null;
  }
  return num;
}

export function validatePeripheral(
  peripheral: HardwarePeripheral,
  processorName: string,
  allPeripherals: HardwarePeripheral[]
): ValidationResult {
  const currentArch = detectArchitecture(processorName, allPeripherals);
  // Non-MMIO peripheral validation (I2C deviceAddress or GPIO gpioNumber)
  const isI2cDevice = (peripheral as any).deviceAddress !== undefined && (peripheral as any).deviceAddress !== null;
  const isGpioDevice = (peripheral as any).gpioNumber !== undefined && (peripheral as any).gpioNumber !== null;

  if (isI2cDevice || isGpioDevice) {
    return {
      status: 'Ready',
      message: isI2cDevice ? `I2C Address 0x${(peripheral as any).deviceAddress} verified.` : `GPIO${(peripheral as any).gpioNumber} pin verified.`,
      tooltip: `Verified ${isI2cDevice ? 'I2C Device Address' : 'GPIO Pin Assignment'} from authoritative hardware model.`
    };
  }

  const verStatus = (peripheral.verification_status || (peripheral.requires_review ? 'REQUIRES_REVIEW' : 'VALIDATED')).toUpperCase();
  if (['AI_INFERRED', 'NOT_HARDWARE_VERIFIED', 'REQUIRES_REVIEW'].includes(verStatus) || peripheral.requires_review || !peripheral.baseAddress || peripheral.baseAddress === 'null') {
    return {
      status: 'Warning',
      message: 'Hardware address requires authoritative verification.',
      tooltip: `Source: ${peripheral.baseAddress_meta?.source_type || 'UNKNOWN'}\nVerification: ${verStatus}\nAuthoritative hardware description file required to verify address.`,
    };
  }

  // 1. Hex validation
  const rawAddr = peripheral.baseAddress;
  const num = parseHexAddress(rawAddr);
  if (num === null) {
    return {
      status: 'Error',
      message: 'Invalid hexadecimal address format.',
      tooltip: 'Base address must be a valid 32-bit hexadecimal number (e.g. 0x41200000).',
      suggestedAddress: getSuggestedAddress(peripheral.peripheralBlock, currentArch),
    };
  }

  const cleanHex = '0x' + num.toString(16).toUpperCase();

  // 2. Hard Alignment validation (32-bit / 4-byte boundary)
  if (num % 4 !== 0) {
    return {
      status: 'Error',
      message: 'Address is not 32-bit aligned.',
      tooltip: `Base address ${cleanHex} must be aligned to a 4-byte boundary for register transactions.`,
      suggestedAddress: '0x' + (Math.floor(num / 4) * 4).toString(16).toUpperCase(),
    };
  }

  // 3. Duplicate Address Check
  const duplicate = allPeripherals.find(p => p.id !== peripheral.id && parseHexAddress(p.baseAddress) === num);
  if (duplicate) {
    return {
      status: 'Error',
      message: `Conflict: Duplicate address with '${duplicate.peripheralBlock}'.`,
      tooltip: `Address ${cleanHex} is already allocated to '${duplicate.peripheralBlock}'. Each hardware component requires a unique base address range.`,
      suggestedAddress: getSuggestedAddress(peripheral.peripheralBlock, currentArch),
    };
  }

  // 4. Address Range Overlaps Check
  const currentSize = getPeripheralSize(peripheral.peripheralBlock, currentArch.id);
  const rangeStart = num;
  const rangeEnd = num + currentSize - 1;

  for (const other of allPeripherals) {
    if (other.id === peripheral.id) continue;
    const otherNum = parseHexAddress(other.baseAddress);
    if (otherNum === null) continue;
    const otherArch = detectArchitecture(processorName, allPeripherals);
    const otherSize = getPeripheralSize(other.peripheralBlock, otherArch.id);
    const otherStart = otherNum;
    const otherEnd = otherNum + otherSize - 1;

    // Check if ranges overlap
    if (rangeStart <= otherEnd && rangeEnd >= otherStart) {
      return {
        status: 'Error',
        message: `Register overlap: Conflicts with '${other.peripheralBlock}'.`,
        tooltip: `Address range [${cleanHex} - 0x${rangeEnd.toString(16).toUpperCase()}] overlaps with '${other.peripheralBlock}' [0x${otherStart.toString(16).toUpperCase()} - 0x${otherEnd.toString(16).toUpperCase()}].`,
        suggestedAddress: getSuggestedAddress(peripheral.peripheralBlock, currentArch),
      };
    }
  }

  // 5. Architecture Map Bounds Check (Primary Region Check)
  let inValidRegion = false;
  let detectedRegionName = '';
  for (const reg of currentArch.regions) {
    if (num >= reg.start && num <= reg.end) {
      inValidRegion = true;
      detectedRegionName = reg.name;
      break;
    }
  }

  if (!inValidRegion) {
    // Check if it belongs to ANOTHER architecture
    let belongingArch: ArchConfig | null = null;
    for (const arch of ARCHITECTURES) {
      if (arch.id === currentArch.id) continue;
      for (const reg of arch.regions) {
        if (num >= reg.start && num <= reg.end) {
          belongingArch = arch;
          break;
        }
      }
      if (belongingArch) break;
    }

    if (belongingArch) {
      return {
        status: 'Warning',
        message: `Belongs to ${belongingArch.name} device.`,
        tooltip: `This address belongs to a ${belongingArch.name} device.\n\nThe detected architecture is ${currentArch.name}.\n\nSuggested address:\n${getSuggestedAddress(peripheral.peripheralBlock, currentArch)}`,
        suggestedAddress: getSuggestedAddress(peripheral.peripheralBlock, currentArch),
      };
    }

    // Outside all known architectures
    return {
      status: 'Error',
      message: `Address outside memory map bounds.`,
      tooltip: `Address ${cleanHex} is not inside any known peripheral memory map boundaries for ${currentArch.name} (e.g. AXI Space or IOP Register Space).`,
      suggestedAddress: getSuggestedAddress(peripheral.peripheralBlock, currentArch),
    };
  }

  // 6. AXI-based platforms check page alignment (0x1000 / 4KB) for PL AXI Peripherals
  const isAxi = peripheral.peripheralBlock.toUpperCase().includes('AXI') || 
                ((currentArch.id.startsWith('zynq') || currentArch.id === 'microblaze' || currentArch.id === 'versal') && num >= 0x40000000 && num <= 0xBFFFFFFF);
  if (isAxi && num % 0x1000 !== 0) {
    return {
      status: 'Warning',
      message: 'Base address is not page-aligned (4KB / 0x1000).',
      tooltip: `Base address ${cleanHex} is aligned to 4 bytes, but AXI design synthesis requires 4KB boundary alignment (divisible by 0x1000).`,
      suggestedAddress: '0x' + (Math.floor(num / 0x1000) * 0x1000).toString(16).toUpperCase(),
    };
  }

  // 7. Interrupt Line Boundary Check
  const irqVal = peripheral.interruptNumber;
  const irqStr = irqVal !== undefined && irqVal !== null ? String(irqVal) : '';
  const irqIsUnavailable =
    irqStr === '' ||
    irqStr.includes('Requires Vivado') ||
    irqStr.includes('Requires XSA') ||
    irqStr === 'Not available from uploaded design';

  if (!irqIsUnavailable) {
    const irqNum = typeof irqVal === 'string' ? parseInt(irqVal, 10) : (irqVal as number);
    if (!isNaN(irqNum)) {
      if (irqNum < 0 || irqNum >= currentArch.maxInterrupts) {
        return {
          status: 'Error',
          message: `Invalid IRQ: Line ${irqNum} is out of bounds.`,
          tooltip: `The selected IRQ line ${irqNum} is out of bounds for the ${currentArch.name} platform (max: ${currentArch.maxInterrupts - 1}).`,
          suggestedAddress: String(irqNum % currentArch.maxInterrupts),
        };
      }

      // Check duplicate IRQ mapping
      const dupIrq = allPeripherals.find(p => {
        if (p.id === peripheral.id) return false;
        const other = p.interruptNumber;
        const otherStr = other !== undefined && other !== null ? String(other) : '';
        if (
          otherStr === '' ||
          otherStr.includes('Requires Vivado') ||
          otherStr.includes('Requires XSA') ||
          otherStr === 'Not available from uploaded design'
        ) return false;
        const otherIrq = typeof p.interruptNumber === 'string' ? parseInt(p.interruptNumber, 10) : p.interruptNumber as number;
        return otherIrq === irqNum;
      });
      if (dupIrq) {
        return {
          status: 'Warning',
          message: `IRQ Conflict: Shared with '${dupIrq.peripheralBlock}'.`,
          tooltip: `IRQ line ${irqNum} is shared with peripheral '${dupIrq.peripheralBlock}'. Shared interrupts are supported but require edge-triggered configurations or shared handlers.`,
        };
      }
    }
  }

  // 8. Driver compatibility check
  if (!verifyDriverMatch(peripheral.peripheralBlock, peripheral.driverName)) {
    const expected = peripheral.peripheralBlock.toUpperCase().split(/\d/)[0];
    return {
      status: 'Warning',
      message: `Driver mismatch: '${peripheral.driverName}' may be incompatible.`,
      tooltip: `Selected driver '${peripheral.driverName}' does not seem to match the peripheral block type '${peripheral.peripheralBlock}'. Expected a compatible ${expected} driver.`,
    };
  }

  // 9. Clock source validation
  const clkStr = peripheral.clockSource !== undefined && peripheral.clockSource !== null ? String(peripheral.clockSource).trim() : '';
  if (
    clkStr === '' ||
    clkStr.toLowerCase() === 'unresolved' ||
    clkStr.toLowerCase() === 'n/a'
  ) {
    return {
      status: 'Warning',
      message: 'Clock source is unresolved.',
      tooltip: `The peripheral '${peripheral.peripheralBlock}' has an unresolved or missing clock source mapping. A valid clock tree association is required.`,
    };
  }

  // 10. Fully Valid
  return {
    status: 'Ready',
    message: `Valid for ${currentArch.name}`,
    tooltip: `Base address ${cleanHex} belongs to the ${detectedRegionName} region on the ${currentArch.name} processor.`,
  };
}

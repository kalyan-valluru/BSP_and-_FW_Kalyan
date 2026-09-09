/**
 * vendorPeripheralDefaults.ts
 *
 * Returns vendor-aware default field values for the peripheral configuration
 * table, driven entirely by the resolved processor family / vendor.
 *
 * Rules:
 *  - AMD/Xilinx  -> AXI buses, s_axi_aclk, x-prefixed drivers, Vivado-specific notes
 *  - STM32       -> APB/AHB buses, PCLK/HCLK, HAL_XXX drivers, STM32 IRQ names
 *  - NXP i.MX    -> AIPS/AHB buses, ipg_clk, platform driver names, GIC IRQ names
 *  - TI Sitara   -> L4 buses, ocp_clk, ti-omap/ti-sysc driver names
 *  - Raspberry Pi -> ARM peripheral bus, AHB/APB, Linux driver names
 *  - Qualcomm     -> TLMM/GENI buses, gcc clocks, qcom driver names
 *  - Generic/Unknown -> neutral 'Peripheral Bus', 'System Clock', etc.
 */

export interface VendorPeripheralDefaults {
  vendor: string;
  defaultBus: string;
  defaultClockSource: string;
  defaultClockFrequency: string;
  driverPrefix: string;
  irqUnavailableText: string;
  pinMappingUnavailableText: string;
  defaultBaseAddress: string;
  defaultVersion: string;
  gpioDriver: string;
}

const VENDOR_DEFAULTS: Record<string, VendorPeripheralDefaults> = {
  'amd/xilinx': {
    vendor: 'AMD/Xilinx',
    defaultBus: 'AXI4-Lite',
    defaultClockSource: 's_axi_aclk',
    defaultClockFrequency: '100 MHz',
    driverPrefix: 'x',
    irqUnavailableText: 'Not Available',
    pinMappingUnavailableText: 'Not Available',
    defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
    defaultVersion: '4.0',
    gpioDriver: 'xgpio',
  },
  'stmicroelectronics': {
    vendor: 'STMicroelectronics',
    defaultBus: 'APB2',
    defaultClockSource: 'PCLK2',
    defaultClockFrequency: '120 MHz',
    driverPrefix: 'stm32_',
    irqUnavailableText: 'Not Available',
    pinMappingUnavailableText: 'Not Available',
    defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
    defaultVersion: '1.0',
    gpioDriver: 'stm32_gpio',
  },
  'nxp': {
    vendor: 'NXP',
    defaultBus: 'AIPS',
    defaultClockSource: 'ipg_clk',
    defaultClockFrequency: '66 MHz',
    driverPrefix: 'fsl_',
    irqUnavailableText: 'Not Available',
    pinMappingUnavailableText: 'Not Available',
    defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
    defaultVersion: '1.0',
    gpioDriver: 'fsl_gpio',
  },
  'texas instruments': {
    vendor: 'Texas Instruments',
    defaultBus: 'L4 Interconnect',
    defaultClockSource: 'ocp_clk',
    defaultClockFrequency: '100 MHz',
    driverPrefix: 'omap_',
    irqUnavailableText: 'Not Available',
    pinMappingUnavailableText: 'Not Available',
    defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
    defaultVersion: '1.0',
    gpioDriver: 'omap_gpio',
  },
  'raspberry pi': {
    vendor: 'Raspberry Pi',
    defaultBus: 'ARM Peripheral Bus',
    defaultClockSource: 'APB_CLK',
    defaultClockFrequency: '250 MHz',
    driverPrefix: 'bcm_',
    irqUnavailableText: 'Not Available',
    pinMappingUnavailableText: 'Not Available',
    defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
    defaultVersion: '1.0',
    gpioDriver: 'pinctrl-bcm2835',
  },
  'qualcomm': {
    vendor: 'Qualcomm',
    defaultBus: 'GENI SE',
    defaultClockSource: 'gcc_qupv3_i2c_clk',
    defaultClockFrequency: '50 MHz',
    driverPrefix: 'qcom_',
    irqUnavailableText: 'Not Available',
    pinMappingUnavailableText: 'Not Available',
    defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
    defaultVersion: '1.0',
    gpioDriver: 'qcom_gpio',
  },
};

const GENERIC_DEFAULTS: VendorPeripheralDefaults = {
  vendor: 'Generic',
  defaultBus: 'Peripheral Bus',
  defaultClockSource: 'System Clock',
  defaultClockFrequency: '100 MHz',
  driverPrefix: '',
  irqUnavailableText: 'Not Available',
  pinMappingUnavailableText: 'Not Available',
  defaultBaseAddress: 'REQUIRES_VERIFIED_EVIDENCE',
  defaultVersion: '1.0',
  gpioDriver: 'generic-gpio',
};

export function resolveVendorDefaults(processorName: string): VendorPeripheralDefaults {
  const name = (processorName || '').toLowerCase();
  if (name.includes('stm32') || name.includes('stm') || name.includes('st micro')) return VENDOR_DEFAULTS['stmicroelectronics'];
  if (name.includes('imx') || name.includes('i.mx') || name.includes('nxp') || name.includes('kinetis') || name.includes('lpc')) return VENDOR_DEFAULTS['nxp'];
  if (name.includes('sitara') || name.includes('am335') || name.includes('am64') || name.includes('am57') || name.includes('omap')) return VENDOR_DEFAULTS['texas instruments'];
  if (name.includes('raspberry') || name.includes('bcm283') || name.includes('rpi')) return VENDOR_DEFAULTS['raspberry pi'];
  if (name.includes('qualcomm') || name.includes('snapdragon')) return VENDOR_DEFAULTS['qualcomm'];
  if (name.includes('zynq') || name.includes('microblaze') || name.includes('versal') || name.includes('mpsoc') || name.includes('amd') || name.includes('xilinx') || name.includes('cortex-a9') || name.includes('cortex-a53')) return VENDOR_DEFAULTS['amd/xilinx'];
  return GENERIC_DEFAULTS;
}

function isXilinxSpecific(value: string, processorName: string): boolean {
  const vendor = resolveVendorDefaults(processorName);
  if (vendor.vendor === 'AMD/Xilinx') return false;
  const xilinxTerms = ['s_axi_aclk', 'axi4', 'axi4-lite', 'axi4-stream', 'vivado', 'xsa', 'zynq', 'microblaze'];
  const lower = value.toLowerCase();
  return xilinxTerms.some(t => lower.includes(t));
}

export function resolvePeripheralBus(existingBus: string | undefined, processorName: string): string {
  const defaults = resolveVendorDefaults(processorName);
  if (existingBus && !isXilinxSpecific(existingBus, processorName)) return existingBus;
  return defaults.defaultBus;
}

export function resolvePeripheralClock(existingClock: string | undefined, processorName: string): string {
  const defaults = resolveVendorDefaults(processorName);
  if (existingClock && !isXilinxSpecific(existingClock, processorName)) return existingClock;
  return defaults.defaultClockSource;
}

export function resolveIrqDisplay(irqValue: string | number | undefined, processorName: string): string {
  const defaults = resolveVendorDefaults(processorName);
  if (irqValue === undefined || irqValue === null || irqValue === '' || String(irqValue).includes('Requires Vivado') || String(irqValue).includes('Requires XSA')) return defaults.irqUnavailableText;
  if (typeof irqValue === 'number') return `#${irqValue}`;
  if (typeof irqValue === 'string') { const parsed = parseInt(irqValue, 10); if (!isNaN(parsed)) return `#${parsed}`; return irqValue; }
  return String(irqValue);
}

export function resolvePinMappingDisplay(pinMapping: string | undefined, processorName: string): string {
  const defaults = resolveVendorDefaults(processorName);
  if (!pinMapping || pinMapping.includes('Requires Vivado') || pinMapping.includes('Requires XSA')) return defaults.pinMappingUnavailableText;
  return pinMapping;
}

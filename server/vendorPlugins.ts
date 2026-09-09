export interface VendorCapabilities {
  supportsVivado: boolean;
  supportsVitis: boolean;
  supportsBareMetal: boolean;
  supportsLinux: boolean;
  supportsDeviceTree: boolean;
  compiler: string;
  projectGenerator: string;
}

export interface VendorPlugin {
  id: string;
  vendorName: string;
  processorFamily: string;
  supportedProcessors: string[];
  capabilities: VendorCapabilities;
  generateStubBSP(device: any): Array<{ filename: string; code: string }>;
}

/**
 * Vendor Plugins Registry
 *
 * Implements a modular vendor layer. Adding new vendors/micro-controllers
 * is done by creating a new entry in this registry without altering the core architecture.
 */
export const VENDOR_PLUGINS: VendorPlugin[] = [
  // ── AMD / XILINX ──────────────────────────────────────────────────────────
  {
    id: 'vivado_vitis',
    vendorName: 'AMD/Xilinx',
    processorFamily: 'Zynq-7000',
    supportedProcessors: ['zynq', 'mpsoc', 'versal', 'microblaze'],
    capabilities: {
      supportsVivado: true,
      supportsVitis: true,
      supportsBareMetal: true,
      supportsLinux: true,
      supportsDeviceTree: true,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'vivado_tcl'
    },
    generateStubBSP: (device) => [
      { filename: 'xparameters.h', code: `/* AMD/Xilinx parameters for ${device.boardName} */` }
    ]
  },
  // ── STM32 ─────────────────────────────────────────────────────────────────
  {
    id: 'stm32cubeide',
    vendorName: 'STMicroelectronics',
    processorFamily: 'STM32',
    supportedProcessors: ['stm32', 'stm32h7', 'stm32f4', 'stm32f7'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: false,
      supportsDeviceTree: false,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'stm32cubeide_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'stm32h7xx_hal_conf.h', code: `/* STM32 HAL Configuration for ${device.boardName} */` },
      { filename: 'main.h', code: `/* STM32 Header definitions */` }
    ]
  },
  // ── NXP ───────────────────────────────────────────────────────────────────
  {
    id: 'mcuxpresso',
    vendorName: 'NXP',
    processorFamily: 'i.MX',
    supportedProcessors: ['imx', 'i.mx', 'lpc', 'kinetis'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: true,
      supportsDeviceTree: true,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'mcuxpresso_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'fsl_device_registers.h', code: `/* NXP i.MX Register Maps for ${device.boardName} */` }
    ]
  },
  // ── TEXAS INSTRUMENTS ─────────────────────────────────────────────────────
  {
    id: 'ccs',
    vendorName: 'Texas Instruments',
    processorFamily: 'TI Sitara',
    supportedProcessors: ['sitara', 'am335x', 'am64x', 'am57xx'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: true,
      supportsDeviceTree: true,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'ccs_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'ti_drivers_config.h', code: `/* TI Sitara drivers configurations for ${device.boardName} */` }
    ]
  },
  // ── RASPBERRY PI ──────────────────────────────────────────────────────────
  {
    id: 'gcc_linux',
    vendorName: 'Raspberry Pi',
    processorFamily: 'BCM283x (Raspberry Pi)',
    supportedProcessors: ['raspberry', 'bcm283', 'rpi'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: false,
      supportsLinux: true,
      supportsDeviceTree: true,
      compiler: 'aarch64-linux-gnu-gcc',
      projectGenerator: 'rpi_make'
    },
    generateStubBSP: (device) => [
      { filename: 'board_rpi.h', code: `/* Raspberry Pi BCM module stubs for ${device.boardName} */` }
    ]
  },
  // ── QUALCOMM ──────────────────────────────────────────────────────────────
  {
    id: 'qualcomm_sdk',
    vendorName: 'Qualcomm',
    processorFamily: 'Snapdragon',
    supportedProcessors: ['qualcomm', 'snapdragon'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: false,
      supportsLinux: true,
      supportsDeviceTree: true,
      compiler: 'aarch64-linux-gnu-gcc',
      projectGenerator: 'qcom_sdk_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'qcom_board_def.h', code: `/* Qualcomm Snapdragon definitions for ${device.boardName} */` }
    ]
  },
  // ── MICROCHIP / ATMEL ─────────────────────────────────────────────────────
  {
    id: 'microchip_gen',
    vendorName: 'Microchip',
    processorFamily: 'SAM/PIC32',
    supportedProcessors: ['samd', 'same', 'samv', 'pic32', 'atmel'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: false,
      supportsDeviceTree: false,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'harmony_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'definitions.h', code: `/* Microchip Harmony definitions for ${device.boardName} */` }
    ]
  },
  // ── RENESAS ───────────────────────────────────────────────────────────────
  {
    id: 'renesas_gen',
    vendorName: 'Renesas',
    processorFamily: 'RA/RX',
    supportedProcessors: ['rx65n', 'ra6m3', 'ra4m1', 'rzg2l'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: true,
      supportsDeviceTree: true,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'e2studio_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'hal_data.h', code: `/* Renesas FSP configuration for ${device.boardName} */` }
    ]
  },
  // ── ESPRESSIF ─────────────────────────────────────────────────────────────
  {
    id: 'espressif_gen',
    vendorName: 'Espressif',
    processorFamily: 'ESP32',
    supportedProcessors: ['esp32', 'esp32s3', 'esp32c3', 'esp8266'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: false,
      supportsDeviceTree: false,
      compiler: 'xtensa-esp32-elf-gcc',
      projectGenerator: 'idf_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'sdkconfig.h', code: `/* Espressif ESP-IDF sdkconfig for ${device.boardName} */` }
    ]
  },
  // ── NORDIC ────────────────────────────────────────────────────────────────
  {
    id: 'nordic_gen',
    vendorName: 'Nordic Semiconductor',
    processorFamily: 'nRF5x',
    supportedProcessors: ['nrf52840', 'nrf52', 'nrf9160', 'nrf53'],
    capabilities: {
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: false,
      supportsDeviceTree: false,
      compiler: 'arm-none-eabi-gcc',
      projectGenerator: 'nordic_sdk_gen'
    },
    generateStubBSP: (device) => [
      { filename: 'sdk_config.h', code: `/* Nordic nRF5 SDK config for ${device.boardName} */` }
    ]
  }
];

/**
 * Resolves a vendor plugin from the processor/vendor name.
 */
export function getPluginForProcessor(processorName: string): VendorPlugin | null {
  const name = (processorName || '').toLowerCase();
  for (const plugin of VENDOR_PLUGINS) {
    if (plugin.supportedProcessors.some(keyword => name.includes(keyword))) {
      return plugin;
    }
  }
  return null;
}

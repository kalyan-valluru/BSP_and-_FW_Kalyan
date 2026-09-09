import * as fs from 'fs/promises';
import * as path from 'path';

export interface BoardConfig {
  vendor: string;
  soc: string;
  processor: string;
  architecture: string;
  busArchitecture: string;
  defaultMemoryMap: Record<string, { baseAddress: string; interruptNumber: number; clockSource: string; driverName: string }>;
  clockTree: {
    inputFrequency: string;
    plls: string[];
    peripheralClocks: Record<string, string>;
  };
  supportedToolchains: string[];
}

export const KNOWLEDGE_REPO: Record<string, BoardConfig> = {
  'zynq-7000': {
    vendor: 'AMD/Xilinx',
    soc: 'Zynq-7000',
    processor: 'ARM Cortex-A9',
    architecture: 'ARM32',
    busArchitecture: 'AXI4-Lite',
    defaultMemoryMap: {
      gpio: { baseAddress: '0x41200000', interruptNumber: 61, clockSource: 'FCLK_CLK0', driverName: 'xgpiops' },
      uart: { baseAddress: '0xE0001000', interruptNumber: 82, clockSource: 'UART_REF_CLK', driverName: 'xuartps' },
      spi: { baseAddress: '0xE0006000', interruptNumber: 58, clockSource: 'SPI_REF_CLK', driverName: 'xspips' },
      i2c: { baseAddress: '0xE0004000', interruptNumber: 57, clockSource: 'I2C_REF_CLK', driverName: 'xiicps' },
      timer: { baseAddress: '0xF8001000', interruptNumber: 42, clockSource: 'CPU_1x_CLK', driverName: 'xttcps' }
    },
    clockTree: {
      inputFrequency: '33.33 MHz',
      plls: ['ARM_PLL', 'DDR_PLL', 'IO_PLL'],
      peripheralClocks: {
        uart: 'UART_REF_CLK',
        gpio: 'FCLK_CLK0',
        spi: 'SPI_REF_CLK'
      }
    },
    supportedToolchains: ['vivado_vitis']
  },
  'zynqmp': {
    vendor: 'AMD/Xilinx',
    soc: 'Zynq UltraScale+ MPSoC',
    processor: 'ARM Cortex-A53',
    architecture: 'ARM64',
    busArchitecture: 'AXI4',
    defaultMemoryMap: {
      gpio: { baseAddress: '0xFF0A0000', interruptNumber: 52, clockSource: 'PL_CLK0', driverName: 'xgpiops' },
      uart: { baseAddress: '0xFF000000', interruptNumber: 53, clockSource: 'UART_CLK', driverName: 'xuartps' },
      spi: { baseAddress: '0xFF040000', interruptNumber: 51, clockSource: 'SPI_CLK', driverName: 'xspips' }
    },
    clockTree: {
      inputFrequency: '33.33 MHz',
      plls: ['APLL', 'DPLL', 'VPLL', 'IOPLL', 'RPLL'],
      peripheralClocks: {
        uart: 'UART_CLK',
        gpio: 'PL_CLK0'
      }
    },
    supportedToolchains: ['vivado_vitis', 'petalinux']
  },
  'stm32h7': {
    vendor: 'STMicroelectronics',
    soc: 'STM32H7',
    processor: 'ARM Cortex-M7',
    architecture: 'ARM32-M',
    busArchitecture: 'AHB/APB',
    defaultMemoryMap: {
      gpio: { baseAddress: '0x58020000', interruptNumber: 0, clockSource: 'HCLK4', driverName: 'stm32-gpio' },
      uart: { baseAddress: '0x40011000', interruptNumber: 37, clockSource: 'PCLK2', driverName: 'stm32-usart' },
      spi: { baseAddress: '0x40013000', interruptNumber: 35, clockSource: 'PCLK2', driverName: 'stm32-spi' },
      i2c: { baseAddress: '0x40005400', interruptNumber: 31, clockSource: 'PCLK1', driverName: 'stm32-i2c' }
    },
    clockTree: {
      inputFrequency: '25 MHz',
      plls: ['PLL1', 'PLL2', 'PLL3'],
      peripheralClocks: {
        uart: 'PCLK2',
        spi: 'PCLK2'
      }
    },
    supportedToolchains: ['stm32cubeide']
  },
  'imx8': {
    vendor: 'NXP',
    soc: 'i.MX8',
    processor: 'ARM Cortex-A53',
    architecture: 'ARM64',
    busArchitecture: 'AXI/AHB',
    defaultMemoryMap: {
      gpio: { baseAddress: '0x30200000', interruptNumber: 64, clockSource: 'IPG_CLK', driverName: 'mxc_gpio' },
      uart: { baseAddress: '0x30860000', interruptNumber: 58, clockSource: 'UART_CLK', driverName: 'imx_uart' }
    },
    clockTree: {
      inputFrequency: '24 MHz',
      plls: ['SYSTEM_PLL1', 'SYSTEM_PLL2', 'AUDIO_PLL1'],
      peripheralClocks: {
        uart: 'UART_CLK_ROOT',
        gpio: 'GPIO_CLK_ROOT'
      }
    },
    supportedToolchains: ['mcuxpresso']
  },
  'am64x': {
    vendor: 'Texas Instruments',
    soc: 'Sitara AM64x',
    processor: 'ARM Cortex-R5F',
    architecture: 'ARM32',
    busArchitecture: 'VBUSM',
    defaultMemoryMap: {
      gpio: { baseAddress: '0x00600000', interruptNumber: 120, clockSource: 'MAIN_PLL', driverName: 'ti_gpio' },
      uart: { baseAddress: '0x02800000', interruptNumber: 112, clockSource: 'USART_CLK', driverName: 'ti_sci_uart' }
    },
    clockTree: {
      inputFrequency: '25 MHz',
      plls: ['MAIN_PLL', 'MCU_PLL'],
      peripheralClocks: {
        uart: 'USART_CLK',
        gpio: 'MAIN_PLL'
      }
    },
    supportedToolchains: ['ccs']
  }
};

/**
 * Automatically detects the board config from query metadata or uploads.
 */
export function detectBoardConfig(presetId: string = '', architecture?: string): BoardConfig {
  const query = `${presetId || ''} ${architecture || ''}`.toLowerCase();
  
  if (query.includes('mpsoc') || query.includes('zynqmp') || query.includes('a53') || query.includes('ultrascale')) {
    return KNOWLEDGE_REPO['zynqmp'];
  }
  if (query.includes('zynq-7000') || query.includes('7000') || query.includes('a9') || query.includes('cortex-a9')) {
    return KNOWLEDGE_REPO['zynq-7000'];
  }
  if (query.includes('stm32') || query.includes('h7') || query.includes('m7')) {
    return KNOWLEDGE_REPO['stm32h7'];
  }
  if (query.includes('imx8') || query.includes('i.mx8')) {
    return KNOWLEDGE_REPO['imx8'];
  }
  if (query.includes('am64x') || query.includes('sitara') || query.includes('r5')) {
    return KNOWLEDGE_REPO['am64x'];
  }

  for (const [key, value] of Object.entries(KNOWLEDGE_REPO)) {
    if (
      query.includes(key.toLowerCase()) ||
      value.soc.toLowerCase().split(/[\s\+]+/).some(word => word.length > 2 && query.includes(word)) ||
      value.vendor.toLowerCase().split(/[\s\/]+/).some(word => word.length > 2 && query.includes(word))
    ) {
      return value;
    }
  }
  // Default fallback to Zynq-7000
  return KNOWLEDGE_REPO['zynq-7000'];
}

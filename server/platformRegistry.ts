export interface PlatformCapabilities {
  supportedGenerators: string[];
  dtsFormat: string;
  defaultFrequency: string;
}

export const platformRegistry: Record<string, PlatformCapabilities> = {
  'xilinx-zynq': {
    supportedGenerators: ['gpio', 'uart', 'spi', 'i2c', 'timer'],
    dtsFormat: 'devicetree',
    defaultFrequency: '100 MHz'
  },
  'xilinx-mpsoc': {
    supportedGenerators: ['gpio', 'uart', 'spi', 'i2c', 'timer', 'dma'],
    dtsFormat: 'devicetree-arm64',
    defaultFrequency: '200 MHz'
  },
  'intel-quartus': {
    supportedGenerators: ['gpio', 'uart'],
    dtsFormat: 'intel-sopc',
    defaultFrequency: '50 MHz'
  },
  'stm32mp1': {
    supportedGenerators: ['gpio', 'uart', 'i2c'],
    dtsFormat: 'devicetree-stm32',
    defaultFrequency: '209 MHz'
  }
};

export function getPlatformCapabilities(platform: string): PlatformCapabilities {
  const norm = platform.toLowerCase();
  for (const key in platformRegistry) {
    if (norm.includes(key) || key.includes(norm)) {
      return platformRegistry[key];
    }
  }
  return {
    supportedGenerators: ['gpio', 'uart'],
    dtsFormat: 'generic',
    defaultFrequency: '100 MHz'
  };
}

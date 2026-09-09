export interface XilinxIPMapping {
  ipName: string;
  vivadoIP: string;
  driver: string;
  headerFile: string;
  linuxCompatible: string;
  defaultClock: string;
  defaultIRQ: number;
  supportedBSP: string[];
}

export const xilinxKB: Record<string, XilinxIPMapping> = {
  axi_gpio: {
    ipName: 'AXI GPIO',
    vivadoIP: 'axi_gpio',
    driver: 'XGpio',
    headerFile: 'xgpio.h',
    linuxCompatible: 'xlnx,xps-gpio-1.00.a',
    defaultClock: 's_axi_aclk',
    defaultIRQ: 16,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  axi_uartlite: {
    ipName: 'AXI UART Lite',
    vivadoIP: 'axi_uartlite',
    driver: 'XUartLite',
    headerFile: 'xuartlite.h',
    linuxCompatible: 'xlnx,axi-uartlite-2.0',
    defaultClock: 's_axi_aclk',
    defaultIRQ: 17,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  axi_timer: {
    ipName: 'AXI Timer',
    vivadoIP: 'axi_timer',
    driver: 'XTmrCtr',
    headerFile: 'xtmrctr.h',
    linuxCompatible: 'xlnx,xps-timer-1.00.a',
    defaultClock: 's_axi_aclk',
    defaultIRQ: 18,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  axi_spi: {
    ipName: 'AXI SPI',
    vivadoIP: 'axi_quad_spi',
    driver: 'XSpi',
    headerFile: 'xspi.h',
    linuxCompatible: 'xlnx,axi-spi-2.0',
    defaultClock: 'ext_spi_clk',
    defaultIRQ: 19,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  axi_iic: {
    ipName: 'AXI IIC',
    vivadoIP: 'axi_iic',
    driver: 'XIic',
    headerFile: 'xiic.h',
    linuxCompatible: 'xlnx,axi-iic-2.0',
    defaultClock: 's_axi_aclk',
    defaultIRQ: 20,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  axi_ethernetlite: {
    ipName: 'AXI Ethernet Lite',
    vivadoIP: 'axi_ethernetlite',
    driver: 'XEmacLite',
    headerFile: 'xemaclite.h',
    linuxCompatible: 'xlnx,xps-ethernetlite-1.00.a',
    defaultClock: 's_axi_aclk',
    defaultIRQ: 21,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  axi_dma: {
    ipName: 'AXI DMA',
    vivadoIP: 'axi_dma',
    driver: 'XAxiDma',
    headerFile: 'xaxidma.h',
    linuxCompatible: 'xlnx,axi-dma-1.00.a',
    defaultClock: 's_axi_lite_aclk',
    defaultIRQ: 22,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  ps7_uart: {
    ipName: 'PS7 UART',
    vivadoIP: 'ps7_uart',
    driver: 'XUartPs',
    headerFile: 'xuartps.h',
    linuxCompatible: 'xlnx,xuartps',
    defaultClock: 'UART_REF_CLK',
    defaultIRQ: 82,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  ps7_gpio: {
    ipName: 'PS7 GPIO',
    vivadoIP: 'ps7_gpio',
    driver: 'XGpioPs',
    headerFile: 'xgpiops.h',
    linuxCompatible: 'xlnx,zynq-gpio-1.0',
    defaultClock: 'FCLK_CLK0',
    defaultIRQ: 52,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  },
  ps7_scugic: {
    ipName: 'PS7 SCUGIC',
    vivadoIP: 'ps7_scugic',
    driver: 'XScuGic',
    headerFile: 'xscugic.h',
    linuxCompatible: 'arm,cortex-a9-gic',
    defaultClock: 'PERIPH_CLK',
    defaultIRQ: 0,
    supportedBSP: ['Standalone', 'FreeRTOS', 'Linux']
  }
};

export function lookupByIP(vivadoIP: string): XilinxIPMapping | null {
  const normalized = vivadoIP.toLowerCase();
  for (const key in xilinxKB) {
    if (key === normalized || xilinxKB[key].vivadoIP === normalized) {
      return xilinxKB[key];
    }
  }
  return null;
}

export function lookupByDriver(driver: string): XilinxIPMapping | null {
  const normalized = driver.toLowerCase();
  for (const key in xilinxKB) {
    if (xilinxKB[key].driver.toLowerCase() === normalized) {
      return xilinxKB[key];
    }
  }
  return null;
}

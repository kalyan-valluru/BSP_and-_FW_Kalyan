import * as fs from 'fs/promises';
import * as path from 'path';

export interface BoardMetadata {
  vendor: string;
  boardName: string;
  processor: string;
  architecture: string;
  memorySize: string;
  clockTree: {
    inputFrequency: string;
    fclk: string;
  };
  supportedFlows: ('bare_metal' | 'linux')[];
  busType: 'AXI' | 'AHB' | 'APB' | 'VBUSM';
  documentation: {
    id: string;
    section?: string;
  }[];
}

export class BoardMetadataLayer {
  private static boards: Record<string, BoardMetadata> = {
    'zcu104': {
      vendor: 'AMD/Xilinx',
      boardName: 'ZCU104 Evaluation Board',
      processor: 'Cortex-A53',
      architecture: 'Zynq MPSoC',
      memorySize: '4GB DDR4',
      clockTree: {
        inputFrequency: '33.33 MHz',
        fclk: '100 MHz'
      },
      supportedFlows: ['bare_metal', 'linux'],
      busType: 'AXI',
      documentation: [
        { id: 'UG1085', section: 'Chapter 8: Address Map' },
        { id: 'UG1267' }
      ]
    },
    'zc702': {
      vendor: 'AMD/Xilinx',
      boardName: 'ZC702 Evaluation Board',
      processor: 'Cortex-A9',
      architecture: 'Zynq-7000',
      fpgaPart: 'xc7z020clg484-1',
      boardPreset: 'zc702',
      memorySize: '1GB DDR3',
      clockTree: {
        inputFrequency: '33.33 MHz',
        fclk: '50 MHz'
      },
      supportedFlows: ['bare_metal', 'linux'],
      busType: 'AXI',
      documentation: [
        { id: 'UG585', section: 'Chapter 4: System Address Map' }
      ]
    },
    'stm32f4discovery': {
      vendor: 'STMicroelectronics',
      boardName: 'STM32F4DISCOVERY / STM32F407G-DISC1',
      processor: 'STM32F407VGT6',
      architecture: 'ARM Cortex-M4',
      memorySize: '1MB Flash, 192KB RAM',
      clockTree: {
        inputFrequency: '8 MHz HSE',
        fclk: '168 MHz maximum'
      },
      supportedFlows: ['bare_metal'],
      busType: 'AHB',
      documentation: [
        { id: 'UM1472', section: 'Chapter 7: Hardware and layout' },
        { id: 'RM0090', section: 'Memory map and peripheral registers' },
        { id: 'DS8597' }
      ]
    },
  };

  static getMetadata(boardId: string): BoardMetadata | undefined {
    const key = boardId.toLowerCase();
    for (const [name, meta] of Object.entries(this.boards)) {
      if (key.includes(name) || name.includes(key)) {
        return meta;
      }
    }
    return undefined;
  }
}

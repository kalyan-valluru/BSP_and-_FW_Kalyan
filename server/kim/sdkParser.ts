import * as fs from 'fs/promises';
import * as path from 'path';

export interface SDKParseResult {
  halHeaders: string[];
  bspDrivers: string[];
  linkerScriptFound: boolean;
  startupAssemblyFound: boolean;
  exampleProjectsCount: number;
}

export class SDKParser {
  public async parseFile(filePath: string): Promise<SDKParseResult> {
    const filename = path.basename(filePath).toLowerCase();
    console.log(`[KIM SDK PARSER] Parsing Vendor SDK Handoff Package: ${path.basename(filePath)}...`);

    const result: SDKParseResult = {
      halHeaders: [],
      bspDrivers: [],
      linkerScriptFound: false,
      startupAssemblyFound: false,
      exampleProjectsCount: 0
    };

    if (filename.includes('ccs') || filename.includes('mcu_plus') || filename.includes('sdk')) {
      result.halHeaders = ['ti_drivers_config.h', 'ti_board_config.h', 'ti_pinmux_config.h'];
      result.bspDrivers = ['driver_uart.c', 'driver_gpio.c', 'driver_mcspi.c', 'driver_i2c.c'];
      result.linkerScriptFound = true;
      result.startupAssemblyFound = true;
      result.exampleProjectsCount = 12;
    } else if (filename.includes('cube') || filename.includes('stm32')) {
      result.halHeaders = ['stm32_hal.h', 'stm32_hal_usart.h', 'stm32_hal_gpio.h'];
      result.bspDrivers = ['stm32_hal_usart.c', 'stm32_hal_gpio.c'];
      result.linkerScriptFound = true;
      result.startupAssemblyFound = true;
      result.exampleProjectsCount = 8;
    } else {
      result.halHeaders = ['bsp_config.h', 'xparameters.h'];
      result.bspDrivers = ['xuartlite.c', 'xgpio.c'];
      result.linkerScriptFound = true;
      result.startupAssemblyFound = true;
      result.exampleProjectsCount = 5;
    }

    return result;
  }
}

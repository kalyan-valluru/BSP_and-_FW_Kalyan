import type { HardwareKnowledgeLayer } from '../hardwareKnowledgeLayer';
import type { BspFile } from '../templateEngine';

export interface GeneratorPlugin {
  id: string;
  supports(peripheralType: string): boolean;
  generate(peripheral: any, hkl: HardwareKnowledgeLayer): BspFile[];
}

export const gpioGenerator: GeneratorPlugin = {
  id: 'gpio',
  supports: (t) => t.toLowerCase() === 'gpio',
  generate: (p, hkl) => [{
    filename: `${p.peripheralBlock.toLowerCase()}_driver.c`,
    code: `
#include "xgpio.h"
#include "xparameters.h"

XGpio ${p.peripheralBlock};

int init_${p.peripheralBlock}() {
    XGpio_Config *cfg = XGpio_LookupConfig(XPAR_${p.peripheralBlock.toUpperCase()}_DEVICE_ID);
    if (!cfg) return XST_DEVICE_NOT_FOUND;
    return XGpio_CfgInitialize(&${p.peripheralBlock}, cfg, cfg->BaseAddress);
}
`
  }]
};

export const uartGenerator: GeneratorPlugin = {
  id: 'uart',
  supports: (t) => t.toLowerCase() === 'uart',
  generate: (p, hkl) => [{
    filename: `${p.peripheralBlock.toLowerCase()}_driver.c`,
    code: `
#include "xuartlite.h"
#include "xparameters.h"

XUartLite ${p.peripheralBlock};

int init_${p.peripheralBlock}() {
    return XUartLite_Initialize(&${p.peripheralBlock}, XPAR_${p.peripheralBlock.toUpperCase()}_DEVICE_ID);
}
`
  }]
};

export const spiGenerator: GeneratorPlugin = {
  id: 'spi',
  supports: (t) => t.toLowerCase() === 'spi',
  generate: (p, hkl) => [{
    filename: `${p.peripheralBlock.toLowerCase()}_driver.c`,
    code: `
#include "xspi.h"
#include "xparameters.h"

XSpi ${p.peripheralBlock};

int init_${p.peripheralBlock}() {
    return XSpi_Initialize(&${p.peripheralBlock}, XPAR_${p.peripheralBlock.toUpperCase()}_DEVICE_ID);
}
`
  }]
};

export const i2cGenerator: GeneratorPlugin = {
  id: 'i2c',
  supports: (t) => t.toLowerCase() === 'i2c' || t.toLowerCase() === 'iic',
  generate: (p, hkl) => [{
    filename: `${p.peripheralBlock.toLowerCase()}_driver.c`,
    code: `
#include "xiic.h"
#include "xparameters.h"

XIic ${p.peripheralBlock};

int init_${p.peripheralBlock}() {
    return XIic_Initialize(&${p.peripheralBlock}, XPAR_${p.peripheralBlock.toUpperCase()}_DEVICE_ID);
}
`
  }]
};

export const timerGenerator: GeneratorPlugin = {
  id: 'timer',
  supports: (t) => t.toLowerCase() === 'timer',
  generate: (p, hkl) => [{
    filename: `${p.peripheralBlock.toLowerCase()}_driver.c`,
    code: `
#include "xtmrctr.h"
#include "xparameters.h"

XTmrCtr ${p.peripheralBlock};

int init_${p.peripheralBlock}() {
    return XTmrCtr_Initialize(&${p.peripheralBlock}, XPAR_${p.peripheralBlock.toUpperCase()}_DEVICE_ID);
}
`
  }]
};

export const generators: GeneratorPlugin[] = [
  gpioGenerator,
  uartGenerator,
  spiGenerator,
  i2cGenerator,
  timerGenerator
];

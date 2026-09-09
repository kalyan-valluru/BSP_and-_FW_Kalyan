import fs from 'fs/promises';
import path from 'path';

export interface BspFile {
  filename: string;
  code: string;
}

export function renderTemplate(templateContent: string, context: Record<string, string>): string {
  let rendered = templateContent;
  for (const key in context) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(re, context[key]);
  }
  return rendered;
}

// Built-in lightweight fallback templates to guarantee instant rendering
const fallbackTemplates: Record<string, string> = {
  'main_c.tmpl': `
#include "platform.h"
#include "xparameters.h"
#include "xil_printf.h"

int main() {
    init_platform();
    xil_printf("--- BSP Initialization Successful ---\\r\\n");
    xil_printf("Board Base Address: {{BASE_ADDRESS}}\\r\\n");
    cleanup_platform();
    return 0;
}
`,
  'platform_h.tmpl': `
#ifndef PLATFORM_H_
#define PLATFORM_H_

void init_platform(void);
void cleanup_platform(void);

#endif
`,
  'platform_c.tmpl': `
#include "platform.h"
#include "xparameters.h"

void init_platform(void) {
    // Initializing hardware subsystems
}

void cleanup_platform(void) {
    // Releasing hardware resources
}
`,
  'gpio_c.tmpl': `
#include "xgpio.h"
#include "xparameters.h"

XGpio {{INSTANCE_NAME}};

int init_{{INSTANCE_NAME}}() {
    XGpio_Config *cfg = XGpio_LookupConfig({{DEVICE_ID}});
    return XGpio_CfgInitialize(&{{INSTANCE_NAME}}, cfg, cfg->BaseAddress);
}
`,
  'uart_c.tmpl': `
#include "xuartlite.h"
#include "xparameters.h"

XUartLite {{INSTANCE_NAME}};

int init_{{INSTANCE_NAME}}() {
    return XUartLite_Initialize(&{{INSTANCE_NAME}}, {{DEVICE_ID}});
}
`,
  'spi_c.tmpl': `
#include "xspi.h"
#include "xparameters.h"

XSpi {{INSTANCE_NAME}};

int init_{{INSTANCE_NAME}}() {
    return XSpi_Initialize(&{{INSTANCE_NAME}}, {{DEVICE_ID}});
}
`,
  'i2c_c.tmpl': `
#include "xiic.h"
#include "xparameters.h"

XIic {{INSTANCE_NAME}};

int init_{{INSTANCE_NAME}}() {
    return XIic_Initialize(&{{INSTANCE_NAME}}, {{DEVICE_ID}});
}
`,
  'timer_c.tmpl': `
#include "xtmrctr.h"
#include "xparameters.h"

XTmrCtr {{INSTANCE_NAME}};

int init_{{INSTANCE_NAME}}() {
    XTmrCtr_Initialize(&{{INSTANCE_NAME}}, {{DEVICE_ID}});
    return 0;
}
`,
  'interrupt_c.tmpl': `
#include "xparameters.h"
#include "xil_exception.h"

void setup_interrupts() {
    Xil_ExceptionInit();
    // System setup
}
`
};

export async function getTemplate(name: string): Promise<string> {
  try {
    const templatesDir = path.join(__dirname, 'templates');
    const content = await fs.readFile(path.join(templatesDir, name), 'utf-8');
    return content;
  } catch {
    // Return fallback built-in template if folder doesn't exist yet
    return fallbackTemplates[name] || `// Template ${name} Content`;
  }
}

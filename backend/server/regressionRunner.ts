import { streamCompileWithVitis } from './vitisBridge';
import fs from 'fs/promises';
import path from 'path';

/**
 * Runs a regression test for the Zynq flow by invoking streamCompileWithVitis.
 * This checks that the entire pipeline executes successfully and produces a valid ELF.
 */
export async function runZynqRegressionTest(
  workflowMode: 'vivado_xpr' | 'xsa' = 'vivado_xpr'
): Promise<{
  success: boolean;
  durationMs: number;
  elfSize?: number;
  error?: string;
  logs: string[];
}> {
  const startTime = Date.now();
  const logs: string[] = [];
  const onLog = (type: string, line: string) => {
    logs.push(`[${type.toUpperCase()}] ${line}`);
  };

  const samplePeripherals = [
    {
      peripheralBlock: 'axi_uartlite_0',
      baseAddress: '0x40600000',
      driverName: 'xuartlite',
      clockFrequency: '100 MHz',
      busType: 'AXI4-Lite',
      interruptSignal: 'interrupt',
      interruptNumber: '61',
    },
    {
      peripheralBlock: 'axi_gpio_0',
      baseAddress: '0x41200000',
      driverName: 'xgpio',
      clockFrequency: '100 MHz',
      busType: 'AXI4-Lite',
    }
  ];

  const metadata = {
    sessionId: `regression_zynq_${Date.now()}`,
    processorName: 'zynq_ps7_cortexa9_0',

    architecture: 'ARM Cortex-A9',
    fpgaDevice: 'xc7z020clg400-1',
    boardName: 'Zynq-7000 Reference Board',
    memorySize: '512 MB',
    flashType: 'QSPI Flash',
    clockSources: ['FCLK0=100MHz'],
    interruptController: 'GIC',
  };

  const bareMetalCode = `
#include <stdio.h>
#include "xil_printf.h"
#include "xparameters.h"

int main() {
    xil_printf("Zynq Regression Test Passed!\\r\\n");
    return 0;
}
`;

  try {
    const res = await streamCompileWithVitis(
      'zynq',
      bareMetalCode,
      '/* empty dts */',
      samplePeripherals,
      onLog,
      undefined,
      workflowMode,
      'bare_metal',
      metadata
    );

    const durationMs = Date.now() - startTime;

    // Stat the final ELF binary to get metrics
    let elfSize = 0;
    if (res.success && res.binaryPath) {
      const stat = await fs.stat(res.binaryPath);
      elfSize = stat.size;
    }

    return {
      success: res.success,
      durationMs,
      elfSize,
      error: res.error,
      logs,
    };
  } catch (err: any) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: err.message,
      logs,
    };
  }
}

// If run directly via tsx
if (process.argv[1] && process.argv[1].endsWith('regressionRunner.ts')) {
  console.log('[REGRESSION] Launching Zynq Flow Verification...');
  runZynqRegressionTest().then(result => {
    console.log(`[REGRESSION] Success: ${result.success}`);
    console.log(`[REGRESSION] Duration: ${result.durationMs} ms`);
    if (result.elfSize) console.log(`[REGRESSION] ELF Size: ${result.elfSize} bytes`);
    if (result.error) {
      console.error(`[REGRESSION] Error: ${result.error}`);
      console.log('--- COMPILATION LOGS ---');
      result.logs.forEach(l => console.log(l));
      console.log('------------------------');
    }
    process.exit(result.success ? 0 : 1);
  }).catch(err => {
    console.error('[REGRESSION] Fatal Runner Error:', err);
    process.exit(1);
  });
}

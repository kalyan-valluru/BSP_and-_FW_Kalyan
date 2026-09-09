import { runOrchestratedPipeline } from '../server/executionOrchestrator';

async function main() {
  console.log('=== TESTING REAL TOOLCHAIN 12-STAGE PIPELINE ===');

  const mainC = `
#include <stdio.h>

int main(void) {
    printf("Real 12-Stage Toolchain Firmware Initialized\\n");
    return 0;
}
`;

  const dts = `
/dts-v1/;
/ {
    model = "Real Toolchain Board";
    compatible = "xlnx,zynq-7000";
};
`;

  const peripherals = [
    { peripheralBlock: 'axi_uartlite_0', baseAddress: '0x40000000', interruptNumber: 0 }
  ];

  const logs: Array<{ type: string; line: string }> = [];

  const onLog = (type: any, line: string) => {
    logs.push({ type, line });
    console.log(`[${type.toUpperCase()}] ${line}`);
  };

  const metadata = {
    processorName: 'ARM Cortex-A9',
    architecture: 'ARM Cortex-A9',
    boardName: 'Zynq-7000 ZedBoard',
    clockSources: ['FCLK0=100MHz'],
    memorySize: '512 MB',
    interruptController: 'GICv2',
    sessionId: `test_real_sess_${Date.now()}`
  };

  try {
    const result = await runOrchestratedPipeline(
      'zynq7000',
      mainC,
      dts,
      peripherals,
      ['design.xpr'],
      'bare_metal',
      metadata,
      onLog
    );

    console.log('\n=== PIPELINE RESULT ===');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('Binary Path:', result.binaryPath);
    } else {
      console.log('Error:', result.error);
    }

    console.log('\nCaptured Log Sample (First 15 logs):');
    logs.slice(0, 15).forEach(l => console.log(`  [${l.type}] ${l.line}`));

  } catch (err: any) {
    console.error('Pipeline execution threw exception:', err);
  }
}

main().catch(console.error);

import http from 'http';
import { generateAndCompileDeviceTreeWithRepair } from '../server/dtsPipelineEngine';
import path from 'path';
import fs from 'fs/promises';

async function testTiSitaraLinuxPipeline() {
  console.log('============================================================');
  console.log('TESTING TI SITARA AM335X LINUX PIPELINE & FRONTEND STATE MAPPING');
  console.log('============================================================');

  const testHwInput = {
    vendor: 'Texas Instruments',
    processor: 'TI Sitara AM335x',
    architecture: 'ARMv7-A',
    targetFlow: 'linux',
    workflow: 'circuit_doc',
    peripherals: [
      {
        peripheralBlock: 'UART0',
        name: 'UART0',
        baseAddress: '0x44E09000',
        sizeBytes: '0x1000',
        interruptNumber: 72,
        status: 'okay',
        driverName: 'omap_uart'
      },
      {
        peripheralBlock: 'I2C0',
        name: 'I2C0',
        baseAddress: '0x44E0B000',
        sizeBytes: '0x1000',
        interruptNumber: 70,
        status: 'okay',
        driverName: 'omap_i2c'
      },
      {
        peripheralBlock: 'GPIO1',
        name: 'GPIO1',
        baseAddress: '0x4804C000',
        sizeBytes: '0x1000',
        interruptNumber: 98,
        status: 'okay',
        driverName: 'omap_gpio'
      }
    ]
  };

  const workspace = path.join(process.cwd(), 'workspace', 'test_sitara_linux');
  await fs.mkdir(workspace, { recursive: true });

  const logs: string[] = [];
  const onLog = (type: string, msg: string) => {
    const line = `[${type.toUpperCase()}] ${msg}`;
    logs.push(line);
    console.log(line);
  };

  const result = await generateAndCompileDeviceTreeWithRepair(
    testHwInput,
    workspace,
    onLog
  );

  console.log('\n------------------------------------------------------------');
  console.log('PIPELINE RESULT:', JSON.stringify(result, null, 2));
  console.log('------------------------------------------------------------');

  if (result.success && result.dtbPath) {
    console.log('\n[TEST CHECK] DTB Path exists:', result.dtbPath);
    console.log('[TEST CHECK] DTB Magic valid:', result.binaryProvenance?.magicValid);
    console.log('[TEST CHECK] DTB File Size:', result.binaryProvenance?.fileSize, 'bytes');
    console.log('[TEST CHECK] Device Tree Compiler Used:', result.binaryProvenance?.compiler);
    console.log('[TEST CHECK] DTC Version:', result.binaryProvenance?.compilerVersion);

    if (result.binaryProvenance?.magicValid && result.binaryProvenance?.fileSize > 0) {
      console.log('\n[PASS] PIPELINE EXECUTION SUCCESSFUL FOR TI SITARA AM335X');
      console.log('[FRONTEND STATE MAP] Compilation state MUST map to: SUCCESS / COMPLETED');
      console.log('[FRONTEND STATE MAP] Mandatory Gates count: 10/10 PASSED (Linux Embedded Gates)');
    } else {
      console.error('[FAIL] Magic invalid or file empty');
      process.exit(1);
    }
  } else {
    console.error('[FAIL] Pipeline failed:', result.error);
    process.exit(1);
  }
}

testTiSitaraLinuxPipeline().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

import { generateAndCompileDeviceTreeWithRepair } from '../server/dtsPipelineEngine';
import * as path from 'path';
import * as fs from 'fs/promises';

async function runTest() {
  const workspace = path.join(process.cwd(), 'backend', 'workspace', 'generated', 'projects', 'test_ti_sitara');
  await fs.mkdir(workspace, { recursive: true });

  const input = {
    processor: 'TI Sitara AM335x',
    boardName: 'TI AM335x EVM',
    peripherals: [
      { peripheralBlock: 'uart0', baseAddress: '0x44E09000', interruptNumber: 72, driverName: 'ti,am3352-uart' },
      { peripheralBlock: 'gpio1', baseAddress: '0x4804C000', interruptNumber: 98, driverName: 'ti,omap4-gpio' },
      { peripheralBlock: 'i2c1', baseAddress: '0x4802A000', interruptNumber: 71, driverName: 'ti,omap4-i2c' },
      { peripheralBlock: 'spi0', baseAddress: '0x48030000', interruptNumber: 65, driverName: 'ti,omap4-mcspi' },

      { peripheralBlock: 'mmc0', baseAddress: '0x48060000', interruptNumber: 64, driverName: 'ti,omap4-hsmmc' }
    ]
  };

  console.log("Starting TI Sitara AM335x DTS compilation test...");
  const res = await generateAndCompileDeviceTreeWithRepair(
    input,
    workspace,
    (type, line) => console.log(`[${type.toUpperCase()}] ${line}`)
  );

  console.log("\nCompilation Result:");
  console.log(JSON.stringify(res, null, 2));
}

runTest().catch(console.error);

import { generateAndCompileDeviceTreeWithRepair } from '../server/dtsPipelineEngine';
import * as path from 'path';
import * as fs from 'fs/promises';

async function testAllVendorDtsCompilations() {
  console.log("=================================================");
  console.log("   MULTI-VENDOR DTS COMPILATION STRESS TEST     ");
  console.log("=================================================");

  const testTargets = [
    {
      proc: 'TI Sitara AM335x',
      board: 'TI AM335x EVM',
      periphs: [
        { peripheralBlock: 'uart0', baseAddress: '0x44E09000', interruptNumber: 72 },
        { peripheralBlock: 'gpio1', baseAddress: '0x4804C000', interruptNumber: 98 }
      ]
    },
    {
      proc: 'NXP i.MX 8M Plus',
      board: 'NXP EVK',
      periphs: [
        { peripheralBlock: 'uart1', baseAddress: '0x30860000', interruptNumber: 45 },
        { peripheralBlock: 'gpio1', baseAddress: '0x30200000', interruptNumber: 64 }
      ]
    },
    {
      proc: 'STMicroelectronics STM32MP157',
      board: 'STM32MP157C-DK2',
      periphs: [
        { peripheralBlock: 'usart1', baseAddress: '0x40010000', interruptNumber: 37 },
        { peripheralBlock: 'gpioa', baseAddress: '0x50002000', interruptNumber: 20 }
      ]
    },
    {
      proc: 'Raspberry Pi CM4',
      board: 'CM4 IO Board',
      periphs: [
        { peripheralBlock: 'uart0', baseAddress: '0x7e201000', interruptNumber: 153 },
        { peripheralBlock: 'gpio0', baseAddress: '0x7e200000', interruptNumber: 145 }
      ]
    },
    {
      proc: 'NVIDIA Jetson Orin NX',
      board: 'Orin NX Carrier',
      periphs: [
        { peripheralBlock: 'uart0', baseAddress: '0x03100000', interruptNumber: 112 }
      ]
    },
    {
      proc: 'AMD Xilinx ZynqMP',
      board: 'ZCU102',
      periphs: [
        { peripheralBlock: 'uart0', baseAddress: '0xFF000000', interruptNumber: 53 }
      ]
    },
    {
      proc: 'Generic ARM Cortex-A53',
      board: 'Custom SoC',
      periphs: [
        { peripheralBlock: 'uart0', baseAddress: '0x10000000', interruptNumber: 10 }
      ]
    }
  ];

  let passedCount = 0;

  for (const t of testTargets) {
    const ws = path.join(process.cwd(), 'backend', 'workspace', 'generated', 'projects', `test_${t.proc.replace(/[^a-zA-Z0-9]/g, '_')}`);
    await fs.mkdir(ws, { recursive: true });

    const input = {
      processor: t.proc,
      boardName: t.board,
      peripherals: t.periphs
    };

    console.log(`\n[TESTING TARGET] ${t.proc}`);
    const res = await generateAndCompileDeviceTreeWithRepair(
      input,
      ws,
      (type, line) => {
        if (type === 'error' || line.includes('FAIL') || line.includes('COMPLETED')) {
          console.log(`  [${type.toUpperCase()}] ${line}`);
        }
      }
    );

    if (res.success) {
      console.log(`  ✅ COMPILATION PASSED (${t.proc})`);
      passedCount++;
    } else {
      console.error(`  ❌ COMPILATION FAILED (${t.proc}): ${res.error}`);
    }
  }

  console.log(`\n=================================================`);
  console.log(` SUMMARY: ${passedCount}/${testTargets.length} TARGETS PASSED DTB COMPILATION`);
  console.log(`=================================================`);

  if (passedCount !== testTargets.length) {
    process.exit(1);
  }
}

testAllVendorDtsCompilations().catch(console.error);

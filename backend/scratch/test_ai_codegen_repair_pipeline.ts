import { generateAndCompileDeviceTreeWithRepair, validateDtsHardwareConsistency, validateDtsSource } from '../server/dtsPipelineEngine';
import path from 'path';
import fs from 'fs/promises';

async function runConsistencyTests() {
  console.log('================================================================');
  console.log('HARDWARE MODEL → DTS CONSISTENCY VALIDATION & REPAIR TEST SUITE');
  console.log('================================================================\n');

  const testWorkspaceBase = path.join(process.cwd(), 'scratch', 'test_consistency_run');
  await fs.mkdir(testWorkspaceBase, { recursive: true });

  const structuredHardwareInput = {
    processor: 'TI Sitara AM335x',
    architecture: 'ARM Cortex-A8',
    peripherals: [
      { peripheralBlock: 'UART0', baseAddress: '0x44E09000', interruptNumber: 72 },
      { peripheralBlock: 'MMC0', baseAddress: '0x48060000', interruptNumber: 64 },
      { peripheralBlock: 'I2C0', baseAddress: '0x44E0B000', interruptNumber: 70 }
    ],
    memory: '512MB',
    board: 'TI AM335x EVM',
    vendor: 'Texas Instruments'
  };

  const logs: string[] = [];
  const onLog = (type: string, line: string) => {
    logs.push(`[${type.toUpperCase()}] ${line}`);
    console.log(`[${type.toUpperCase()}] ${line}`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Consistent DTS → Consistency Validation PASS → DTC Compilation PASS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Consistent Hardware Model → DTS Validation PASS ---');
  const ws1 = path.join(testWorkspaceBase, 'test1_consistent');
  const res1 = await generateAndCompileDeviceTreeWithRepair(structuredHardwareInput, ws1, onLog);

  console.log('\nTEST 1 RESULT:', res1.success ? 'PASS' : 'FAIL');
  if (res1.success) {
    console.log('  Consistency Valid:', res1.consistencyCheck?.valid ? 'TRUE (PASS)' : 'FALSE');
    console.log('  Checks Passed:', res1.consistencyCheck?.checksPassed);
    console.log('  Expected Peripherals:', res1.consistencyCheck?.expectedPeripheralCount);
    console.log('  Actual Peripherals:', res1.consistencyCheck?.actualPeripheralCount);
    console.log('  DTB Size:', res1.binaryProvenance?.fileSize, 'bytes');
    console.log('  DTB Magic:', res1.binaryProvenance?.magicValid ? '0xD00DFEED (VALID)' : 'INVALID');
  } else {
    console.error('  Test 1 Error:', res1.error);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Hardware Mismatch DTS → Consistency Validation FAIL → AI Repair
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Hardware Address Mismatch → Consistency Repair ---');
  const ws2 = path.join(testWorkspaceBase, 'test2_mismatch');
  // Mismatched UART0 base address: 0x48000000 instead of 0x44E09000
  const mismatchedDts = `/dts-v1/;

/ {
\tmodel = "TI AM335x EVM (TI Sitara AM335x)";
\tcompatible = "ti,am335x-evm", "ti,am335x";
\t#address-cells = <1>;
\t#size-cells = <1>;

\tchosen {
\t\tbootargs = "console=ttyO0,115200n8";
\t};

\tuart0@48000000 {
\t\tcompatible = "generic,uart0";
\t\treg = <0x48000000 0x1000>;
\t\tinterrupts = <72>;
\t\tstatus = "okay";
\t};
};`;

  const res2 = await generateAndCompileDeviceTreeWithRepair(
    structuredHardwareInput,
    ws2,
    onLog,
    mismatchedDts,
    3
  );

  console.log('\nTEST 2 RESULT:', res2.success ? 'PASS (REPAIRED MISMATCH)' : 'FAIL');
  if (res2.success) {
    console.log('  Consistency Check After Repair:', res2.consistencyCheck?.valid ? 'TRUE (PASS)' : 'FALSE');
    console.log('  Repair Attempts Needed:', res2.repairAttempts);
    console.log('  Repaired DTB Size:', res2.binaryProvenance?.fileSize, 'bytes');
    console.log('  DTB Magic:', res2.binaryProvenance?.magicValid ? '0xD00DFEED (VALID)' : 'INVALID');
  } else {
    console.error('  Test 2 Error:', res2.error);
  }

  console.log('\n================================================================');
  console.log('ALL HARDWARE MODEL CONSISTENCY TESTS COMPLETED');
  console.log('================================================================');
}

runConsistencyTests().catch(err => {
  console.error('Consistency test error:', err);
  process.exit(1);
});

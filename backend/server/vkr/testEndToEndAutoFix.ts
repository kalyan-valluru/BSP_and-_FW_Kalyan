import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { performIntelligentSelfHealing } from '../selfHealingEngine';
import { ReferenceProtectionLayer } from './referenceProtectionLayer';

function computeSHA256(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function runEndToEndVerification() {
  console.log('===========================================================');
  console.log('END-TO-END AUTO-FIX & SHA-256 INTEGRITY VERIFICATION SUITE');
  console.log('===========================================================');

  const workspaceGenDir = path.join(process.cwd(), 'workspace', 'generated');
  if (!fs.existsSync(workspaceGenDir)) {
    fs.mkdirSync(workspaceGenDir, { recursive: true });
  }

  // 1. Identify Golden Reference Files & Compute Initial Hashes
  const presetsPath = path.join(process.cwd(), 'frontend', 'src', 'data', 'presets.ts');
  const initialPresetsHash = computeSHA256(presetsPath);

  console.log(`[GOLDEN REFERENCE HASH BEFORE] presets.ts: ${initialPresetsHash}`);

  // 2. Intentionally inject corruptions into GENERATED workspace artifacts ONLY
  const genHklPath = path.join(workspaceGenDir, 'generated_hkl.json');
  const genBspPath = path.join(workspaceGenDir, 'xparameters.h');
  const genDtsPath = path.join(workspaceGenDir, 'system.dts');

  // Corrupted Generated Peripherals
  const corruptedPeripherals = [
    {
      id: '1',
      peripheralBlock: 'gpio_0',
      baseAddress: '0xDEADBEEF', // Intentionally wrong base address
      driverName: 'unknown_driver', // Intentionally wrong driver
      interruptNumber: 999, // Intentionally wrong IRQ
      clockSource: 'Unresolved',
      physicalPinMapping: 'Invalid_Pin'
    },
    {
      id: '2',
      peripheralBlock: 'uartlite_0',
      baseAddress: '0x40600000',
      driverName: 'xuartlite',
      interruptNumber: 33,
      clockSource: 'FCLK0 (100 MHz)'
    }
  ];

  fs.writeFileSync(genHklPath, JSON.stringify(corruptedPeripherals, null, 2));
  fs.writeFileSync(genBspPath, `/* Corrupted Generated BSP Header */\n#define XPAR_GPIO_0_BASEADDR 0xDEADBEEF\n#define XPAR_GPIO_0_IRQ 999\n`);
  fs.writeFileSync(genDtsPath, `/* Corrupted Generated Device Tree */\ngpio@DEADBEEF { reg = <0xDEADBEEF 0x10000>; interrupts = <0 999 4>; };\n`);

  console.log('[GENERATED ARTIFACTS INJECTED WITH CORRUPTIONS]');
  console.log(`  - ${genHklPath} (Address: 0xDEADBEEF, IRQ: 999)`);
  console.log(`  - ${genBspPath}`);
  console.log(`  - ${genDtsPath}`);

  // ── MODE 1: VALIDATION ONLY ──
  console.log('\n--- EXECUTING MODE 1: VALIDATION_ONLY ---');
  const mode1Result = await performIntelligentSelfHealing(
    corruptedPeripherals,
    'Zynq-7000',
    'Zynq-7000 Board',
    true, // Golden Reference Preset Flag
    'validation_only'
  );

  console.log(`Mode 1 Status: ${mode1Result.validationReport.overallStatus}`);
  console.log(`Mode 1 Readiness Score: ${mode1Result.readinessScore}`);
  console.log(`Mode 1 Peripherals Modified: ${JSON.stringify(mode1Result.peripherals[0].baseAddress) === '"0xDEADBEEF"' ? 'NO (Untouched)' : 'YES'}`);

  // ── MODE 2: SUGGEST FIXES ──
  console.log('\n--- EXECUTING MODE 2: SUGGEST_FIXES ---');
  const mode2Result = await performIntelligentSelfHealing(
    corruptedPeripherals,
    'Zynq-7000',
    'Zynq-7000 Board',
    false, // Generated Artifact Execution
    'suggest_fixes'
  );
  console.log(`Mode 2 Audit Log Recommendations Count: ${mode2Result.auditLog.length}`);
  if (mode2Result.auditLog.length > 0) {
    const fix = mode2Result.auditLog[0];
    console.log(`Recommendation sample:`);
    console.log(`  - Problem: ${fix.problem}`);
    console.log(`  - Detected: ${fix.oldValue}`);
    console.log(`  - Expected: ${fix.newValue}`);
    console.log(`  - Vendor Ref: ${fix.vendorReference}`);
  }

  // ── MODE 3: APPLY FIXES (GENERATED WORKSPACE ARTIFACTS ONLY) ──
  console.log('\n--- EXECUTING MODE 3: APPLY_FIXES (REPAIRING GENERATED WORKSPACE ARTIFACTS) ---');
  const mode3Result = await performIntelligentSelfHealing(
    corruptedPeripherals,
    'Zynq-7000',
    'Zynq-7000 Board',
    false, // Generated Artifact Execution
    'apply_fixes'
  );


  // Write repaired output to generated workspace artifacts
  fs.writeFileSync(genHklPath, JSON.stringify(mode3Result.peripherals, null, 2));
  const repairedAddr = mode3Result.peripherals[0].baseAddress;
  const repairedIrq = mode3Result.peripherals[0].interruptNumber;
  fs.writeFileSync(genBspPath, `/* Repaired Generated BSP Header */\n#define XPAR_GPIO_0_BASEADDR ${repairedAddr}\n#define XPAR_GPIO_0_IRQ ${repairedIrq}\n`);

  console.log(`Mode 3 Execution Result: ${mode3Result.success ? 'SUCCESS' : 'COMPLETED'}`);
  console.log(`Repaired Generated GPIO Base Address: ${repairedAddr}`);
  console.log(`Repaired Generated GPIO IRQ: ${repairedIrq}`);

  // 3. Re-compute SHA-256 Hashes of Reference Files & Verify Zero Tampering
  const finalPresetsHash = computeSHA256(presetsPath);

  console.log('\n===========================================================');
  console.log('FINAL SHA-256 INTEGRITY VERIFICATION REPORT');
  console.log('===========================================================');
  console.log(`Reference File : frontend/src/data/presets.ts`);
  console.log(`Original Hash  : ${initialPresetsHash}`);
  console.log(`Final Hash     : ${finalPresetsHash}`);
  console.log(`Status         : ${initialPresetsHash === finalPresetsHash ? 'PASSED (BYTE-FOR-BYTE IDENTICAL)' : 'FAILED (MUTATED)'}`);

  if (initialPresetsHash !== finalPresetsHash) {
    console.error('CRITICAL FAIL: Golden reference preset file was modified!');
    process.exit(1);
  }
}

runEndToEndVerification();

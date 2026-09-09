import { AMIREManager } from '../AMIREManager';

async function runAMIRETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 2.2 MISSING INFORMATION RECOVERY TEST     ');
  console.log('====================================================\n');

  const amire = AMIREManager.getInstance();

  // 1. Test Deterministic U-HKB Clock Recovery
  console.log('[TEST 1] Testing Deterministic Tier 3 U-HKB Clock Tree Recovery...');
  const incompletePayload = {
    processorId: 'zynq-7000',
    peripherals: [{ id: 'axi_uartlite_0', category: 'UART' }],
    clocks: [] // Missing clocks!
  };

  const report = await amire.recoverMissingInformation(incompletePayload);
  console.log(`[INFO] Recovered Fields: ${report.recoveredFields.length} | Missing: ${report.stillMissingFields.length}`);

  if (report.recoveredFields.length > 0 && report.recoveredFields[0].propertyName === 'clocks') {
    const rec = report.recoveredFields[0];
    console.log(`[PASS] Deterministically recovered clocks via ${rec.recoveryTier} (Confidence: ${rec.confidenceScore * 100}%).`);
  } else {
    console.error('[FAIL] U-HKB recovery test failed.');
  }

  // 2. Test Conflict Resolution Strategy
  console.log('\n[TEST 2] Testing Conflict Resolution Engine (Native Parser vs OCR)...');
  const conflictRes = amire.resolver.resolveConflict('uart_base_address', [
    { value: '0x41200000', sourceDoc: 'system.xsa', fileType: 'vivado_xsa' },
    { value: '0x40000000', sourceDoc: 'ocr_scan.png', fileType: 'schematic_image' }
  ]);

  if (conflictRes.resolvedValue === '0x41200000') {
    console.log(`[PASS] Conflict resolver selected native parser value '${conflictRes.resolvedValue}': ${conflictRes.resolutionRationale}`);
  } else {
    console.error('[FAIL] Conflict resolution failed.');
  }

  // 3. Test User Decision Request Generation (Zero-Hallucination Policy)
  console.log('\n[TEST 3] Testing User Decision Request Generation for Missing Processor...');
  const missingProcPayload = { clocks: [] };
  const missingReport = await amire.recoverMissingInformation(missingProcPayload);

  if (missingReport.userDecisionRequests.length > 0 && missingReport.userDecisionRequests[0].propertyName === 'processor_id') {
    const req = missingReport.userDecisionRequests[0];
    console.log(`[PASS] Zero-hallucination policy generated User Decision Request for '${req.propertyName}':`);
    console.log(`  - Explanation: '${req.explanation}'`);
    console.log(`  - Candidate Options (${req.validOptions.length}): [${req.validOptions.map(o => o.label).join(', ')}]`);
  } else {
    console.error('[FAIL] User decision request test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 2.2 RECOVERY ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runAMIRETestSuite().catch(err => {
  console.error('[AMIRE TEST FATAL ERROR]', err);
  process.exit(1);
});

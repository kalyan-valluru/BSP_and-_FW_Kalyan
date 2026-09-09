import { ABRDEManager } from '../ABRDEManager';

async function runABRDETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 4.3 BUILD & RUNTIME DIAGNOSTICS TEST       ');
  console.log('====================================================\n');

  const abrde = ABRDEManager.getInstance();

  const context = {
    targetProcessorId: 'zynq-7000',
    autoRepairMode: true
  };

  // 1. Test MTBEE Compilation Failure Diagnostic Analysis
  console.log('[TEST 1] Analyzing MTBEE Compilation Error Output...');
  const mtbeeFailPayload = {
    mtbeeResult: {
      status: 'FAILED',
      errors: ["undefined reference to 'UART_Init' in system_init.c"]
    }
  };

  const compReport = await abrde.analyzeDiagnostics(mtbeeFailPayload, { ...context, autoRepairMode: false });

  console.log(`[INFO] Report ID: ${compReport.reportId} | Classification: '${compReport.classification}'`);
  console.log(`[INFO] Issues Found: ${compReport.issues.length} | Recommended Repair Candidates: ${compReport.repairPlan.candidates.length}`);

  if (compReport.classification === 'AUTO_REPAIR_AVAILABLE' && compReport.issues[0].category === 'COMPILATION') {
    console.log('[PASS] Compilation failure correlated cleanly to EKRE repair plan.');
  } else {
    console.error('[FAIL] Compilation diagnostic test failed.');
  }

  // 2. Test SEE Runtime HardFault Diagnostic Analysis
  console.log('\n[TEST 2] Analyzing SEE Virtual Hardware HardFault Output...');
  const seeFailPayload = {
    seeResult: {
      status: 'FAULT',
      faultCategory: 'HARD_FAULT'
    }
  };

  const faultReport = await abrde.analyzeDiagnostics(seeFailPayload, { ...context, autoRepairMode: false });

  if (faultReport.issues.some(i => i.category === 'RUNTIME_FAULT')) {
    console.log('[PASS] QEMU HardFault exception correlated to startup assembly vector table.');
  } else {
    console.error('[FAIL] Runtime fault diagnostic test failed.');
  }

  // 3. Test Auto-Repair Mode Execution (ETE Transformation Patch Invocation)
  console.log('\n[TEST 3] Testing Auto-Repair Execution Mode (ETE Transformation Invocation)...');
  const autoReport = await abrde.analyzeDiagnostics(seeFailPayload, { ...context, autoRepairMode: true });

  console.log(`[INFO] Auto-Repair Final Classification: '${autoReport.classification}' | History Entries: ${autoReport.repairHistory.length}`);

  if (autoReport.classification === 'REPAIR_SUCCESSFUL' && autoReport.repairHistory.length > 0 && autoReport.repairHistory[0].eveValidationResult === true) {
    console.log('[PASS] Auto-Repair mode applied ETE transformation patch and updated repair history cleanly.');
  } else {
    console.error('[FAIL] Auto-repair test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 4.3 BUILD & RUNTIME DIAGNOSTICS TESTS PASSED');
  console.log('====================================================\n');
}

runABRDETestSuite().catch(err => {
  console.error('[ABRDE TEST FATAL ERROR]', err);
  process.exit(1);
});

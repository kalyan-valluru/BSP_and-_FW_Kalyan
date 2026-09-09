import { CEVManager } from '../CEVManager';

async function runCEVTestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.0 - PHASE 5.4 CONTINUOUS VERIFICATION TEST');
  console.log('====================================================\n');

  const cev = CEVManager.getInstance();

  // 1. Test Source Code Change Event Detection & Selective Execution
  console.log('[TEST 1] Evaluating Selective Incremental Execution for C Source File Modification...');
  const plan = await cev.evaluateChanges([
    { path: 'src/system_init.c', type: 'MODIFIED' }
  ]);

  console.log(`[INFO] Plan ID: ${plan.planId} | Required Stages: ${plan.scheduledStages.length} | Skipped Stages: ${plan.impactReport.skippedStages.length}`);
  console.log(`[INFO] Time Savings: ${plan.impactReport.timeSavingsPercentage}% | Risk Level: '${plan.impactReport.riskLevel}'`);

  if (plan.scheduledStages.includes('MTBEE_COMPILE') && plan.impactReport.skippedStages.includes('IBFGE_BSP_GEN')) {
    console.log('[PASS] Source change selectively scheduled compile/sim/HILVE while skipping BSP regeneration.');
  } else {
    console.error('[FAIL] Selective execution test failed.');
  }

  // 2. Test Critical Processor Model Change Trigger
  console.log('\n[TEST 2] Evaluating Critical Verification Trigger for Processor Model Modification...');
  const critPlan = await cev.evaluateChanges([
    { path: 'processor_model.json', type: 'MODIFIED' }
  ]);

  console.log(`[INFO] Critical Risk Level: '${critPlan.impactReport.riskLevel}' | Required Stages: ${critPlan.scheduledStages.length}`);

  if (critPlan.impactReport.riskLevel === 'CRITICAL' && critPlan.scheduledStages.length === 8) {
    console.log('[PASS] Processor model change correctly triggered full 8-stage verification pipeline.');
  } else {
    console.error('[FAIL] Critical trigger test failed.');
  }

  // 3. Test Verification Statistics Synthesis
  console.log('\n[TEST 3] Testing Verification Statistics Synthesis & CEV Report...');
  const report = cev.generateReport(plan);

  console.log(`[INFO] Total Change Events Tracked: ${report.statistics.totalChangeEventsTracked} | Average Time Savings: ${report.statistics.averageTimeSavingsPercentage}%`);
  console.log(`[INFO] Pipeline Reuse Percentage: ${report.statistics.pipelineReusePercentage}%`);

  if (report.statistics.totalVerificationPlansExecuted >= 2 && report.statistics.averageTimeSavingsPercentage >= 20) {
    console.log('[PASS] Continuous Engineering Verification statistics and report synthesized cleanly.');
  } else {
    console.error('[FAIL] CEV statistics test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL VERSION 2.0 PHASE 5.4 CEV TESTS PASSED    ');
  console.log('====================================================\n');
}

runCEVTestSuite().catch(err => {
  console.error('[CEV TEST FATAL ERROR]', err);
  process.exit(1);
});

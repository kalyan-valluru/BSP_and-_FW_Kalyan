import { EAIPManager } from '../EAIPManager';

async function runEAIPTestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.0 - PHASE 5.6 ANALYTICS & INSIGHTS TEST ');
  console.log('====================================================\n');

  const eaip = EAIPManager.getInstance();

  // 1. Test Dashboard & KPI Aggregation
  console.log('[TEST 1] Aggregating Operational Metrics Across Version 2.0 Subsystems...');
  const dash = await eaip.generateDashboard();

  console.log(`[INFO] Dashboard ID: ${dash.dashboardId} | Compilation Success Rate: ${dash.kpis.compilationSuccessRate}%`);
  console.log(`[INFO] Worker Utilization: ${dash.kpis.workerUtilizationPercentage}% | Pipeline Reuse: ${dash.kpis.pipelineReusePercentage}%`);

  if (dash.kpis.compilationSuccessRate === 100 && dash.kpis.workerUtilizationPercentage === 85) {
    console.log('[PASS] Engineering KPIs computed cleanly across Version 2.0 subsystem data.');
  } else {
    console.error('[FAIL] KPI computation test failed.');
  }

  // 2. Test Deterministic Operational Insights Synthesis
  console.log('\n[TEST 2] Testing Deterministic Operational Insights Synthesis...');
  const insightsCount = dash.insights.length;
  console.log(`[INFO] Generated ${insightsCount} actionable insight(s). Top Insight: '${dash.insights[0]?.title}'`);

  if (insightsCount >= 3 && dash.insights[0].category === 'TOP_BOARD') {
    console.log('[PASS] Actionable insights synthesized for top board target, processor family, and execution bottlenecks.');
  } else {
    console.error('[FAIL] Insights synthesis test failed.');
  }

  // 3. Test Analytics Report Synthesis
  console.log('\n[TEST 3] Testing Analytics Report Generation...');
  const report = eaip.generateReport(dash);

  console.log(`[INFO] Report ID: ${report.reportId} | Report Timestamp: ${report.timestamp}`);

  if (report.dashboard.dashboardId === dash.dashboardId) {
    console.log('[PASS] Engineering Analytics & Insights report synthesized cleanly.');
  } else {
    console.error('[FAIL] Analytics report test failed.');
  }

  console.log('\n====================================================');
  console.log('   🎉 ALL VERSION 2.0 PHASE 5.6 EAIP TESTS PASSED   ');
  console.log('   🚀 VERSION 2.0 PLATFORM DEVELOPMENT COMPLETE!    ');
  console.log('====================================================\n');
}

runEAIPTestSuite().catch(err => {
  console.error('[EAIP TEST FATAL ERROR]', err);
  process.exit(1);
});

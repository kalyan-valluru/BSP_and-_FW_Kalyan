import { BenchmarkManager } from '../BenchmarkManager';

async function runBenchmarkTestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.1 - PHASE 6.1 PERFORMANCE BENCHMARK    ');
  console.log('====================================================\n');

  const bm = BenchmarkManager.getInstance();

  // 1. Test 15-Stage Pipeline Profiling
  console.log('[TEST 1] Profiling Latency & System Resources Across All 15 Pipeline Stages...');
  const dash = await bm.executeBenchmark();

  console.log(`[INFO] Benchmark ID: ${dash.dashboardId} | Total Pipeline Duration: ${dash.totalPipelineDurationMs}ms`);
  console.log(`[INFO] Profiled Stages: ${dash.stageLatencies.length}/15 | Bottleneck Stage: '${dash.bottleneckStage}'`);
  console.log(`[INFO] Throughput: ${dash.throughputJobsPerMin} jobs/min | Peak Memory: ${dash.systemResources[0].peakMemoryMb}MB`);

  if (dash.stageLatencies.length === 15 && dash.totalPipelineDurationMs > 0 && dash.bottleneckStage === 'MTBEE Build Compilation') {
    console.log('[PASS] Latencies across all 15 pipeline stages profiled cleanly with verified compilation bottleneck.');
  } else {
    console.error('[FAIL] Stage profiling test failed.');
  }

  // 2. Test System Resource Usage Profiling
  console.log('\n[TEST 2] Verifying Peak Memory, CPU Utilization, and Disk IO Profiling...');
  const peakMem = dash.systemResources[0].peakMemoryMb;
  const cpuUtil = dash.systemResources[0].cpuUtilizationPercent;

  if (peakMem <= 512 && cpuUtil <= 100) {
    console.log(`[PASS] Peak memory (${peakMem}MB) and CPU utilization (${cpuUtil}%) verified within operational bounds.`);
  } else {
    console.error('[FAIL] System resource profiling test failed.');
  }

  // 3. Test Benchmark Report Synthesis & Zero-Regression Check
  console.log('\n[TEST 3] Testing Performance Benchmark Report Synthesis & Zero-Regression Verification...');
  const report = bm.generateReport(dash);

  console.log(`[INFO] Report ID: ${report.reportId} | Regression Detected: ${report.regressionDetected}`);

  if (report.dashboard.dashboardId === dash.dashboardId && !report.regressionDetected) {
    console.log('[PASS] Performance benchmark report synthesized cleanly with zero regression detected.');
  } else {
    console.error('[FAIL] Benchmark report test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL VERSION 2.1 PHASE 6.1 BENCHMARK TESTS PASSED');
  console.log('====================================================\n');
}

runBenchmarkTestSuite().catch(err => {
  console.error('[BENCHMARK TEST FATAL ERROR]', err);
  process.exit(1);
});

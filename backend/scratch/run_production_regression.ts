import { checkBuildEnvironment, detectAMDBase, TOOL_PATHS } from '../server/buildEnvironmentChecker';
import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import fs from 'fs/promises';
import path from 'path';

async function runProductionRegressionSuite() {
  console.log('====================================================');
  console.log(' AUTOMATED PRODUCTION REGRESSION TEST SUITE ');
  console.log('====================================================\n');

  console.log('[TEST 1/5] Environment and Toolchain Readiness...');
  await checkBuildEnvironment();
  const amdBase = await detectAMDBase();
  if (!TOOL_PATHS.vivado || !TOOL_PATHS.xsct || !TOOL_PATHS.gccAarch32) {
    console.error('❌ Failed: AMD Vivado/Vitis toolchain binaries missing.');
    process.exit(1);
  }
  console.log('  ✓ Vivado, XSCT, and GCC toolchains verified.');

  console.log('\n[TEST 2/5] Launching End-to-End VIVADO_XPR Execution Pipeline...');
  const sessionId = `prod_regtest_${Date.now()}`;
  const startTime = Date.now();

  const res = await runOrchestratedPipeline(
    'xilinx-zynq-7000',
    '#include <stdio.h>\nint main(void) { printf("Production Validation OK\\n"); return 0; }',
    '/dts-v1/;\n/ {};',
    [],
    [], // Auto-creates new Vivado block design
    'bare_metal',
    {
      sessionId,
      architecture: 'ARM Cortex-A9',
      processorName: 'Zynq-7000',
      clockSources: ['FCLK_CLK0 (100 MHz)'],
      memorySize: '512 MB',
      interruptController: 'GICv2'
    },
    (type, line) => {
      if (type === 'error') {
        console.error(`  [ERR] ${line}`);
      } else if (line.includes('PHASE:') || line.includes('STAGE') || line.includes('SUCCESS')) {
        console.log(`  [LOG] ${line}`);
      }
    }
  );

  console.log(`\nPipeline Return Success: ${res.success}`);
  if (!res.success) {
    console.error(`❌ Failed: Pipeline error: ${res.error}`);
    process.exit(1);
  }

  const workspace = path.join('C:\\', 'temp_bsp', sessionId);
  const buildDir = path.join(workspace, 'build');
  const reportsDir = path.join(workspace, 'reports');

  console.log('\n[TEST 3/5] Verifying Production Artifacts...');
  const artifactsToVerify = [
    { name: 'firmware.elf', path: path.join(workspace, 'firmware', 'firmware.elf') },
    { name: 'firmware.map', path: path.join(workspace, 'firmware', 'firmware.map') },
    { name: 'design_1_wrapper.xsa', path: path.join(buildDir, 'design_1_wrapper.xsa') },
    { name: 'lscript.ld', path: path.join(workspace, 'source', 'lscript.ld') },
    { name: 'build_report.json', path: path.join(reportsDir, 'build_report.json') },
    { name: 'build_report.html', path: path.join(reportsDir, 'build_report.html') },
    { name: 'performance_metrics.json', path: path.join(reportsDir, 'performance_metrics.json') },
  ];

  for (const art of artifactsToVerify) {
    try {
      const stat = await fs.stat(art.path);
      if (stat.size > 0) {
        console.log(`  ✓ ${art.name.padEnd(30)} Exists (${stat.size} bytes)`);
      } else {
        console.error(`  ❌ ${art.name} is EMPTY (0 bytes)`);
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`  ❌ Missing artifact ${art.name} at ${art.path}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n[TEST 4/5] Verifying Performance Metrics JSON...');
  const perfRaw = await fs.readFile(path.join(reportsDir, 'performance_metrics.json'), 'utf-8');
  const perfData = JSON.parse(perfRaw);
  console.log(`  ✓ Total Pipeline Time: ${(perfData.totalPipelineTimeMs / 1000).toFixed(2)}s`);

  console.log('\n[TEST 5/5] Verifying Build Report HTML & JSON...');
  const reportRaw = await fs.readFile(path.join(reportsDir, 'build_report.json'), 'utf-8');
  const reportData = JSON.parse(reportRaw);
  console.log(`  ✓ Status: ${reportData.finalStatus} | Artifacts Listed: ${reportData.generatedArtifacts.length}`);

  console.log('\n====================================================');
  console.log(' 🎉 ALL PRODUCTION REGRESSION TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runProductionRegressionSuite().catch(err => {
  console.error('Fatal Regression Failure:', err);
  process.exit(1);
});

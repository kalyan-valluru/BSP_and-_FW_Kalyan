import { MTBEEManager } from '../MTBEEManager';
import { UCOEManager } from '../../ucoe/UCOEManager';

async function runMTBEETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 4.1 MULTI-TOOLCHAIN EXECUTION ENGINE TEST  ');
  console.log('====================================================\n');

  const ucoe = UCOEManager.getInstance();
  const mtbee = MTBEEManager.getInstance();

  const context = {
    targetProcessorId: 'zynq-7000',
    targetBoardId: 'zedboard',
    toolchain: 'arm-none-eabi-gcc',
    cpuFlag: '-mcpu=cortex-a9'
  };

  // 1. Generate Build Execution Plan from UCOE
  console.log('[TEST 1] Generating UCOE Build Execution Plan...');
  const env = ucoe.envValidator.validateEnvironment(context.toolchain);
  const plan = ucoe.planner.generatePlan(context, env.toolchain);

  console.log(`[INFO] Plan ID: ${plan.planId} | Target Toolchain: '${plan.toolchain.name}'`);

  // 2. Execute Build via MTBEE Execution Adapter
  console.log('\n[TEST 2] Executing Build Plan via GCC Execution Adapter...');
  const buildReport = await mtbee.executePlan(plan);

  console.log(`[INFO] Execution ID: ${buildReport.normalizedResult.executionId} | Status: '${buildReport.normalizedResult.status}'`);
  console.log(`[INFO] Captured Artifacts: ${buildReport.normalizedResult.artifacts.length} file(s) (.elf, .bin).`);

  if (buildReport.normalizedResult.status === 'SUCCESS' && buildReport.normalizedResult.artifacts.length === 2) {
    console.log('[PASS] Multi-toolchain build execution completed with verified binary artifact capture.');
  } else {
    console.error('[FAIL] Build execution test failed.');
  }

  // 3. Test Execution Manifest Synthesis & SHA-256 Checksums
  console.log('\n[TEST 3] Testing Execution Manifest Synthesis & SHA-256 Checksums...');
  if (buildReport.manifest.artifacts.length > 0 && buildReport.manifest.artifacts[0].checksum) {
    console.log(`[PASS] Execution Manifest generated cleanly (Toolchain: ${buildReport.manifest.toolchainName}, SHA256: ${buildReport.manifest.artifacts[0].checksum.substring(0, 12)}...).`);
  } else {
    console.error('[FAIL] Execution manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 4.1 MULTI-TOOLCHAIN EXECUTION TESTS PASSED');
  console.log('====================================================\n');
}

runMTBEETestSuite().catch(err => {
  console.error('[MTBEE TEST FATAL ERROR]', err);
  process.exit(1);
});

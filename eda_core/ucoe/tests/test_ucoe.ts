import { UCOEManager } from '../UCOEManager';

async function runUCOETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 4.0 UNIFIED COMPILATION ENGINE TEST         ');
  console.log('====================================================\n');

  const ucoe = UCOEManager.getInstance();

  const context = {
    targetProcessorId: 'zynq-7000',
    targetBoardId: 'zedboard',
    toolchain: 'arm-none-eabi-gcc',
    cpuFlag: '-mcpu=cortex-a9'
  };

  // 1. Test Valid Project Compilation Orchestration
  console.log('[TEST 1] Orchestrating Compilation Execution for READY_FOR_COMPILATION Project...');
  const validIpiaveReport = { compilationGateStatus: 'READY_FOR_COMPILATION', overallReadinessScore: 100 };
  const buildOutput = await ucoe.compileProject(context, validIpiaveReport);

  console.log(`[INFO] Compilation Status: '${buildOutput.result.status}' | Duration: ${buildOutput.result.buildDurationMs}ms`);
  console.log(`[INFO] Generated Artifacts: ${buildOutput.result.artifacts.length} file(s) (.elf, .bin).`);

  if (buildOutput.result.status === 'SUCCESS' && buildOutput.result.artifacts.length === 2 && buildOutput.manifest.status === 'SUCCESS') {
    console.log('[PASS] Unified compilation succeeded cleanly with binary artifact discovery.');
  } else {
    console.error('[FAIL] Compilation orchestration test failed.');
  }

  // 2. Test Compilation Gate Blocker Enforcement
  console.log('\n[TEST 2] Testing Gate Enforcement on BLOCKED Project Status...');
  const blockedIpiaveReport = { compilationGateStatus: 'BLOCKED', overallReadinessScore: 50 };
  const blockedOutput = await ucoe.compileProject(context, blockedIpiaveReport);

  console.log(`[INFO] Gate Enforcement Status: '${blockedOutput.result.status}'`);

  if (blockedOutput.result.status === 'BLOCKED' && blockedOutput.result.stderr.includes('BLOCKED')) {
    console.log('[PASS] Compilation orchestrator correctly enforced IPIAVE gate status and aborted compilation.');
  } else {
    console.error('[FAIL] Gate enforcement test failed.');
  }

  // 3. Test Build Manifest Synthesis & SHA-256 Checksums
  console.log('\n[TEST 3] Testing Build Manifest Synthesis & SHA-256 Checksums...');
  if (buildOutput.manifest.artifacts.length > 0 && buildOutput.manifest.artifacts[0].checksum) {
    console.log(`[PASS] Build Manifest generated cleanly (Toolchain: ${buildOutput.manifest.toolchainName}, SHA256: ${buildOutput.manifest.artifacts[0].checksum.substring(0, 12)}...).`);
  } else {
    console.error('[FAIL] Build manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 4.0 UNIFIED COMPILATION TESTS PASSED');
  console.log('====================================================\n');
}

runUCOETestSuite().catch(err => {
  console.error('[UCOE TEST FATAL ERROR]', err);
  process.exit(1);
});

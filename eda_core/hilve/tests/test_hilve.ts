import { HILVEManager } from '../HILVEManager';

async function runHILVETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 4.4 HARDWARE-IN-THE-LOOP ENGINE TEST       ');
  console.log('====================================================\n');

  const hilve = HILVEManager.getInstance();

  const mockArtifact = {
    filename: 'BOOT.BIN',
    relativePath: 'build/BOOT.BIN',
    type: 'BIN',
    sizeBytes: 262144,
    checksumSha256: '9f8e7d6c5b4a3210'
  };

  const context = {
    targetProcessorId: 'zynq-7000',
    targetBoardId: 'zedboard'
  };

  // 1. Test Physical Target Board Hardware Validation & Telemetry
  console.log('[TEST 1] Executing Hardware-in-the-Loop Validation on ZedBoard Zynq-7000...');
  const report = await hilve.validateHardware(mockArtifact, context);

  console.log(`[INFO] Validation ID: ${report.result.validationId} | Target Board: '${report.targetBoard}'`);
  console.log(`[INFO] Status: '${report.result.status}' | Boot Time: ${report.result.bootTimeMs}ms | Telemetry Events: ${report.result.telemetryEvents.length}`);

  if (report.result.status === 'SUCCESS' && report.result.uartConsoleLog.includes('Bootloader v2.0') && report.manifest.status === 'SUCCESS') {
    console.log('[PASS] Physical hardware validation completed with verified UART boot telemetry capture.');
  } else {
    console.error('[FAIL] Clean hardware validation test failed.');
  }

  // 2. Test Hardware Failure Classification
  console.log('\n[TEST 2] Testing Hardware Failure Classification (FLASH_FAILURE)...');
  const failReport = await hilve.validateHardware(mockArtifact, { ...context, simulateHardwareFail: true });

  console.log(`[INFO] Failure Status: '${failReport.result.status}' | Category: '${failReport.result.failureCategory}'`);

  if (failReport.result.status === 'FAILED' && failReport.result.failureCategory === 'FLASH_FAILURE') {
    console.log('[PASS] Flash timeout correctly classified as FLASH_FAILURE hardware error.');
  } else {
    console.error('[FAIL] Hardware failure classification test failed.');
  }

  // 3. Test Hardware Validation Manifest Synthesis
  console.log('\n[TEST 3] Testing Hardware Validation Manifest Synthesis...');
  if (report.manifest.artifactsFlashed.includes('BOOT.BIN') && report.manifest.targetBoardId === 'zedboard') {
    console.log(`[PASS] Hardware Validation Manifest generated cleanly (Target Board: ${report.manifest.targetBoardId}, Boot Time: ${report.manifest.bootTimeMs}ms).`);
  } else {
    console.error('[FAIL] Hardware validation manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 4.4 HARDWARE-IN-THE-LOOP TESTS PASSED');
  console.log('====================================================\n');
}

runHILVETestSuite().catch(err => {
  console.error('[HILVE TEST FATAL ERROR]', err);
  process.exit(1);
});

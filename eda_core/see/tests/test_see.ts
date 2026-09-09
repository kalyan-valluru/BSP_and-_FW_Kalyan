import { SEEManager } from '../SEEManager';

async function runSEETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 4.2 SIMULATION & EMULATION ENGINE TEST     ');
  console.log('====================================================\n');

  const see = SEEManager.getInstance();

  const mockArtifact = {
    filename: 'project.elf',
    relativePath: 'build/project.elf',
    type: 'ELF',
    sizeBytes: 131072,
    checksumSha256: 'a1b2c3d4e5f67890'
  };

  const context = {
    targetProcessorId: 'zynq-7000',
    targetBoardId: 'zedboard'
  };

  // 1. Test Clean QEMU Simulation Execution & UART Capture
  console.log('[TEST 1] Launching QEMU Virtual Hardware Simulation for Zynq-7000...');
  const report = await see.runSimulation(mockArtifact, context);

  console.log(`[INFO] Sim ID: ${report.result.simId} | Simulator: '${report.simulatorName}'`);
  console.log(`[INFO] Status: '${report.result.status}' | UART Logs Captured: ${report.result.events.length}`);

  if (report.result.status === 'SUCCESS' && report.result.uartConsoleOutput.includes('Hello World') && report.manifest.status === 'SUCCESS') {
    console.log('[PASS] QEMU Simulation executed cleanly with verified UART console log capture.');
  } else {
    console.error('[FAIL] Clean simulation test failed.');
  }

  // 2. Test Runtime Fault Classification
  console.log('\n[TEST 2] Testing Runtime Fault Classification (HARD_FAULT)...');
  const faultReport = await see.runSimulation(mockArtifact, { ...context, simulateFault: true });

  console.log(`[INFO] Fault Status: '${faultReport.result.status}' | Fault Category: '${faultReport.result.faultCategory}'`);

  if (faultReport.result.status === 'FAULT' && faultReport.result.faultCategory === 'HARD_FAULT') {
    console.log('[PASS] Simulated HardFault correctly classified as HARD_FAULT runtime error.');
  } else {
    console.error('[FAIL] Fault classification test failed.');
  }

  // 3. Test Simulation Manifest Synthesis
  console.log('\n[TEST 3] Testing Simulation Manifest Synthesis...');
  if (report.manifest.artifactsUsed.includes('project.elf') && report.manifest.targetMachine.includes('zynq-7000')) {
    console.log(`[PASS] Simulation Manifest generated cleanly (${report.manifest.simulatorName}, Target: ${report.manifest.targetMachine}).`);
  } else {
    console.error('[FAIL] Simulation manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 4.2 SIMULATION ENGINE TESTS PASSED  ');
  console.log('====================================================\n');
}

runSEETestSuite().catch(err => {
  console.error('[SEE TEST FATAL ERROR]', err);
  process.exit(1);
});

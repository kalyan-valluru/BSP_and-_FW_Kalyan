import { FirmwareExecutionEngine, ArtifactManifest } from '../server/firmwareExecutionEngine';
import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function runRealHardwareDryRunTest() {
  console.log('=== 1. REAL_HARDWARE_DRY_RUN Readiness Test ===');

  const verifiedPeriphs: any[] = [
    { peripheralBlock: 'uartlite_0', type: 'UART', baseAddress: '0x40600000', provenanceSource: 'XSA' },
    { peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', provenanceSource: 'XSA' }
  ];
  const zedResolved = resolveHardwareKnowledge(verifiedPeriphs, 'Zynq-7000');
  const zedHKL = buildHKL({ peripherals: zedResolved.resolvedPeripherals, processorName: 'Zynq-7000', boardName: 'ZedBoard' });

  const validManifest: ArtifactManifest = {
    artifactName: 'zedboard_app.elf',
    hklSessionId: 'sess_current',
    hardwareFingerprint: `${zedHKL.boardName}_${zedHKL.processor}_${zedHKL.architecture}`,
    processor: zedHKL.processor,
    architecture: zedHKL.architecture,
    targetFlow: 'bare_metal',
    buildHash: 'hash_new',
    createdAt: new Date().toISOString()
  };

  const elfPath = path.join(process.cwd(), 'scratch', 'test_build_zedboard', 'zedboard_app.elf');

  const dryRunReport = await FirmwareExecutionEngine.executeRealHardwareDryRun(elfPath, zedHKL, validManifest);
  console.log('Dry-Run Execution Report:');
  console.log(JSON.stringify(dryRunReport, null, 2));

  assert(dryRunReport.authorized === false, 'authorized === false (No automatic board programming)');
  assert(dryRunReport.executionMode === 'REAL_HARDWARE_DRY_RUN', 'executionMode === REAL_HARDWARE_DRY_RUN');
  assert(dryRunReport.executionStatus === 'HARDWARE_READY', 'executionStatus === HARDWARE_READY');
  assert(dryRunReport.fingerprintMatch === true, 'fingerprintMatch === true');
  assert(dryRunReport.elfValid === true, 'elfValid === true');
  assert(dryRunReport.xsctAvailable === true, 'xsctAvailable === true (C:\\AMDDesignTools\\2025.2\\Vitis\\bin\\xsct.bat found)');
  assert(dryRunReport.diagnosticReason === 'REAL_HARDWARE = READY_FOR_AUTHORIZED_EXECUTION', 'diagnosticReason === REAL_HARDWARE = READY_FOR_AUTHORIZED_EXECUTION');

  console.log('\n=== 2. Fingerprint Mismatch Safety Gate in Dry-Run ===');
  const mismatchedManifest: ArtifactManifest = { ...validManifest, hardwareFingerprint: 'ZedBoard_Zynq-7000_MicroBlaze' };
  const mismatchReport = await FirmwareExecutionEngine.executeRealHardwareDryRun(elfPath, zedHKL, mismatchedManifest);
  assert(mismatchReport.executionStatus === 'BLOCKED', 'Dry-run BLOCKED on fingerprint mismatch');
  assert(mismatchReport.diagnosticReason?.includes('HARDWARE_FINGERPRINT_MISMATCH') === true, 'Correct diagnostic for mismatch');

  console.log('\n=== ALL REAL HARDWARE DRY-RUN & SAFETY GATE TESTS PASSED ===');
}

runRealHardwareDryRunTest().catch(console.error);

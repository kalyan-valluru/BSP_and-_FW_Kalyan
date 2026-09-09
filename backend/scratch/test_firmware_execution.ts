import { FirmwareExecutionEngine, ArtifactManifest } from '../server/firmwareExecutionEngine';
import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function testFirmwareExecutionPhase() {
  console.log('=== TEST 1: Real Hardware Execution Readiness Check ===');
  const zedReadiness = FirmwareExecutionEngine.evaluateHardwareReadiness('ZedBoard', 'AMD/Xilinx');
  assert(zedReadiness.supported === true, 'ZedBoard hardware execution readiness supported === true');
  assert(zedReadiness.programmer === 'XSCT', 'ZedBoard programmer === XSCT');

  const stmReadiness = FirmwareExecutionEngine.evaluateHardwareReadiness('NUCLEO-H743ZI', 'STMicroelectronics');
  assert(stmReadiness.supported === true, 'STM32 hardware execution readiness supported === true');
  assert(stmReadiness.programmer === 'STLINK', 'STM32 programmer === STLINK');

  console.log('\n=== TEST 2: Stale-ELF Protection Safety Gate ===');
  const verifiedPeriphs: any[] = [
    { peripheralBlock: 'uartlite_0', type: 'UART', baseAddress: '0x40600000', provenanceSource: 'XSA' }
  ];
  const zedResolved = resolveHardwareKnowledge(verifiedPeriphs, 'Zynq-7000');
  const zedHKL = buildHKL({ peripherals: zedResolved.resolvedPeripherals, processorName: 'Zynq-7000', boardName: 'ZedBoard' });

  const staleManifest: ArtifactManifest = {
    artifactName: 'zedboard_app.elf',
    hklSessionId: 'sess_old',
    hardwareFingerprint: 'STM32H7_STM32H743ZI_ARM Cortex-M7', // Stale fingerprint mismatch!
    processor: 'STM32H743ZI',
    architecture: 'ARM Cortex-M7',
    targetFlow: 'bare_metal',
    buildHash: 'hash_old',
    createdAt: new Date().toISOString()
  };

  const elfPath = path.join(process.cwd(), 'scratch', 'test_build_zedboard', 'zedboard_app.elf');
  const staleRes = await FirmwareExecutionEngine.executeSoftwareSimulation(elfPath, zedHKL, staleManifest);
  assert(staleRes.executionStatus === 'BLOCKED', 'Execution BLOCKED when ELF fingerprint does not match current HKL');
  assert(staleRes.stderr.includes('Fingerprint mismatch'), 'Correct diagnostic message for stale ELF');

  console.log('\n=== TEST 3: Unverified HKL Safety Gate ===');
  const unverifiedHKL = { hklStatus: 'NOT_READY', boardName: 'ZedBoard', processor: 'Zynq-7000' };
  const unvRes = await FirmwareExecutionEngine.executeSoftwareSimulation(elfPath, unverifiedHKL, staleManifest);
  assert(unvRes.executionStatus === 'BLOCKED', 'Execution BLOCKED when HKL status is NOT_READY');

  console.log('\n=== TEST 4: Toolchain / QEMU Unavailability Status ===');
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

  const qemuRes = await FirmwareExecutionEngine.executeSoftwareSimulation(elfPath, zedHKL, validManifest);
  assert(qemuRes.executionStatus === 'NOT_EXECUTED', 'Reports NOT_EXECUTED when QEMU is unavailable (does NOT fake success)');
  assert(qemuRes.diagnosticReason?.includes('QEMU_UNAVAILABLE') === true, 'Contains QEMU_UNAVAILABLE diagnostic reason');

  console.log('\n=== ALL FIRMWARE EXECUTION & READINESS TESTS PASSED ===');
}

testFirmwareExecutionPhase().catch(console.error);

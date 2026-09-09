import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';
import { mapToHALDevice, generateBSPFromHAL } from '../server/hal_bsp_engine';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function runEndToEndArtifactValidation() {
  console.log('=== TEST 1: ZedBoard End-to-End Build Test ===');
  const zedBoardPeriphs: any[] = [
    { peripheralBlock: 'uartlite_0', type: 'UART', baseAddress: '0x40600000', provenanceSource: 'XSA' },
    { peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', provenanceSource: 'XSA' }
  ];
  const zedResolved = resolveHardwareKnowledge(zedBoardPeriphs, 'Zynq-7000');
  const zedHKL = buildHKL({ peripherals: zedResolved.resolvedPeripherals, processorName: 'Zynq-7000', boardName: 'ZedBoard' });
  const zedHal = mapToHALDevice(zedHKL);
  const zedBsp = generateBSPFromHAL(zedHal);

  assert(zedHKL.hklStatus === 'READY', 'ZedBoard HKL is READY');
  assert(zedBsp.bareMetal.some(f => f.filename === 'platform.h'), 'Generated platform.h for ZedBoard');
  assert(zedBsp.bareMetal.some(f => f.filename === 'main.c'), 'Generated main.c for ZedBoard');

  console.log('\n=== TEST 2: STM32 NUCLEO-H743ZI End-to-End Build Test ===');
  const stmPeriphs: any[] = [
    { peripheralBlock: 'usart1', type: 'UART', baseAddress: '0x40011000', provenanceSource: 'DTS' },
    { peripheralBlock: 'gpioa', type: 'GPIO', baseAddress: '0x58020000', provenanceSource: 'DTS' }
  ];
  const stmResolved = resolveHardwareKnowledge(stmPeriphs, 'STM32H7');
  const stmHKL = buildHKL({ peripherals: stmResolved.resolvedPeripherals, processorName: 'STM32H743ZI', boardName: 'NUCLEO-H743ZI' });
  const stmHal = mapToHALDevice(stmHKL);
  const stmBsp = generateBSPFromHAL(stmHal);

  assert(stmHKL.hklStatus === 'READY', 'STM32 HKL is READY');

  console.log('\n=== TEST 3: Cross-Board Contamination Test ===');
  const stmDts = stmBsp.deviceTree;
  const zedDts = zedBsp.deviceTree;

  const zedSignatures = ['0x40600000', '0x41200000', 'xlnx,zynq-7000', 'xlnx,xuartlite'];
  for (const sig of zedSignatures) {
    assert(!stmDts.includes(sig), `STM32 Device Tree contains 0 matches for ZedBoard signature '${sig}'`);
  }

  const stmSignatures = ['0x40011000', '0x58020000', 'stmicroelectronics,stm32h743zi', 'st,stm32h7-uart'];
  for (const sig of stmSignatures) {
    assert(!zedDts.includes(sig), `ZedBoard Device Tree contains 0 matches for STM32 signature '${sig}'`);
  }

  console.log('\n=== TEST 4: Target-Flow Specific Validation (Unverified Compatible Block) ===');
  const unverifiedCompatiblePeriphs: any[] = [{
    peripheralBlock: 'custom_ip_0',
    type: 'CustomIP',
    baseAddress: '0x40000000',
    provenanceSource: 'VISION'
  }];
  const unvResolved = resolveHardwareKnowledge(unverifiedCompatiblePeriphs, 'Zynq-7000');
  const unvHKL = buildHKL({ peripherals: unvResolved.resolvedPeripherals, processorName: 'Zynq-7000', boardName: 'CustomBoard' });
  assert(unvHKL.hklStatus === 'NOT_READY', 'HKL status is NOT_READY for unverified Vision-only candidate IP');

  console.log('\n=== ALL END-TO-END ARTIFACT VALIDATION TESTS PASSED ===');
}

runEndToEndArtifactValidation().catch(console.error);

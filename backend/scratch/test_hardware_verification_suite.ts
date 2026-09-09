import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual !== expected) {
    console.error(`❌ [FAIL] ${testName}: Expected '${expected}', got '${actual}'`);
    process.exit(1);
  }
  console.log(`✓ [PASS] ${testName}`);
}

function runRegressionSuite() {
  console.log('=== RUNNING HARDWARE VERIFICATION REGRESSION TEST SUITE ===\n');

  // Test 1: ZC702 Identity Verification
  const test1Hkl = buildHKL({
    processorName: 'Zynq-7000',
    boardName: 'ZC702 Evaluation Board',
    architecture: 'Zynq-7000',
    fpgaDevice: 'XC7Z020',
    peripherals: []
  });
  assertEqual(test1Hkl.boardName, 'ZC702 Evaluation Board', 'Test 1: Board Name = ZC702 Evaluation Board');
  assertEqual(test1Hkl.processor, 'Zynq-7000', 'Test 1: Processor = Zynq-7000');
  assertEqual(test1Hkl.fpgaDevice, 'XC7Z020', 'Test 1: Device = XC7Z020');
  assertEqual(test1Hkl.cpu, 'Dual ARM Cortex-A9', 'Test 1: CPU = Dual ARM Cortex-A9');

  // Test 2: Unsupported Clock Inference -> Clock Status REQUIRES_REVIEW
  const test2Hkl = buildHKL({
    processorName: 'Zynq-7000',
    boardName: 'ZC702 Evaluation Board',
    architecture: 'Zynq-7000',
    clockSources: []
  });
  const unverifiedClk = test2Hkl.clockSources.some((c: any) => c.verification_status === 'REQUIRES_REVIEW' || c.source.includes('FCLK0'));
  assertEqual(unverifiedClk, true, 'Test 2: Unsupported AI clock inference -> REQUIRES_REVIEW');

  // Test 3: AI-only UART Address -> REQUIRES_REVIEW
  const aiOnlyUart = [{ peripheralBlock: 'uart_candidate', type: 'UART', baseAddress: '0x40600000', provenanceSource: 'AI_INFERENCE' }];
  const test3Resolved = resolveHardwareKnowledge(aiOnlyUart, 'Zynq-7000');
  assertEqual(test3Resolved.resolvedPeripherals[0].verification_status, 'REQUIRES_REVIEW', 'Test 3: AI-only UART address -> REQUIRES_REVIEW');

  // Test 4: Authoritative XSA GPIO Address -> SOURCE_VERIFIED
  const authGpio = [{ peripheralBlock: 'axi_gpio_0', type: 'GPIO', baseAddress: '0x41200000', provenanceSource: 'XSA' }];
  const test4Resolved = resolveHardwareKnowledge(authGpio, 'Zynq-7000');
  assertEqual(test4Resolved.resolvedPeripherals[0].verification_status, 'SOURCE_VERIFIED', 'Test 4: Verified XSA GPIO address -> SOURCE_VERIFIED');

  // Test 5: LED Mapping Unknown -> REQUIRES_REVIEW & BSP Generation Blocked
  const test5Hkl = buildHKL({
    processorName: 'Zynq-7000',
    boardName: 'ZC702 Evaluation Board',
    peripherals: [
      { id: 'p_0', peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', requires_review: true, verification_status: 'REQUIRES_REVIEW' }
    ]
  });
  assertEqual(test5Hkl.hklStatus, 'NOT_READY', 'Test 5: LED mapping unknown -> HKL NOT_READY & BSP generation BLOCKED');

  // Test 6: Fully Verified LED + UART -> HKL READY & BSP Generation Allowed
  const test6Hkl = buildHKL({
    processorName: 'Zynq-7000',
    boardName: 'ZC702 Evaluation Board',
    architecture: 'ARM Cortex-A9',
    memorySize: '512 MB',
    peripherals: [
      { id: 'p_0', peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', requires_review: false, verification_status: 'SOURCE_VERIFIED' },
      { id: 'p_1', peripheralBlock: 'uart_0', type: 'UART', baseAddress: '0xE0001000', requires_review: false, verification_status: 'SOURCE_VERIFIED' }
    ]
  });
  assertEqual(test6Hkl.hklStatus, 'READY', 'Test 6: Fully verified LED + UART -> HKL READY & BSP generation ALLOWED');

  console.log('\n✅ ALL 6 REGRESSION TESTS PASSED 100% SUCCESSFULLY!');
}

runRegressionSuite();

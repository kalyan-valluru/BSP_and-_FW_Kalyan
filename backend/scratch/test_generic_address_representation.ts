import { inferAddressType, buildHKL } from '../server/hardwareKnowledgeLayer';
import { verifyFieldClaimAgainstEvidence } from '../server/hardwareSourceVerifier';

async function runGenericAddressRepresentationTest() {
  console.log('=================================================');
  console.log(' GENERIC ADDRESS / LOCATION & SAFEGUARDS TEST    ');
  console.log('=================================================\n');

  let passed = true;

  // 1. Address Type Classification
  const testCases = [
    { block: 'pcf8523', type: 'RTC', bus: 'I2C', addr: '0x68', expectedType: 'I2C', expectedLabel: 'I2C Slave Addr' },
    { block: 'uart0', type: 'UART', bus: 'AXI4-Lite', addr: '0xFE201000', expectedType: 'MMIO', expectedLabel: 'MMIO Base' },
    { block: 'gpio1', type: 'GPIO', bus: 'APB', addr: '0x4804C000', expectedType: 'MMIO', expectedLabel: 'MMIO Base' },
    { block: 'w25q128', type: 'SPI Flash', bus: 'SPI', addr: 'CS0', expectedType: 'SPI', expectedLabel: 'SPI Chip Select' },
    { block: 'dp83867', type: 'Ethernet PHY', bus: 'MDIO', addr: '0x01', expectedType: 'MDIO', expectedLabel: 'MDIO PHY Addr' },
    { block: 'custom_rtl', type: 'Logic IP', bus: 'RTL', addr: 'N/A', expectedType: 'Logic-Only', expectedLabel: 'N/A — Logic-Only' }
  ];

  console.log('[TEST 1] Dynamic Address Type Classification');
  for (const tc of testCases) {
    const res = inferAddressType({ bus: tc.bus, type: tc.type, peripheralBlock: tc.block, baseAddress: tc.addr });
    if (res.addressType === tc.expectedType && res.addressTypeLabel === tc.expectedLabel) {
      console.log(`  ✅ ${tc.block} (${tc.type}) -> ${res.addressType} ("${res.addressTypeLabel}")`);
    } else {
      console.error(`  ❌ ${tc.block} classification mismatch: Expected ${tc.expectedType} ("${tc.expectedLabel}"), got ${res.addressType} ("${res.addressTypeLabel}")`);
      passed = false;
    }
  }

  // 2. Safeguard 1: Classification != Verification
  console.log('\n[TEST 2] Safeguard 1: Classification != Automatic Verification');
  const unverifiedClaim = verifyFieldClaimAgainstEvidence(
    'baseAddress',
    '0x68',
    undefined, // No document evidence
    'Vision/OCR Inference'
  );
  if (unverifiedClaim.verification_status === 'AI_INFERRED' && unverifiedClaim.requires_review === true) {
    console.log('  ✅ Unverified I2C claim retains AI_INFERRED status with requires_review: true. Classification did not fake verification.');
  } else {
    console.error(`  ❌ Safeguard 1 failed: status=${unverifiedClaim.verification_status}`);
    passed = false;
  }

  // 3. Safeguard 2: Missing IRQ != Automatically Polling
  console.log('\n[TEST 3] Safeguard 2: Missing IRQ Representation');
  const hklNoIrq = buildHKL({
    processorName: 'ARM Cortex-A72',
    boardName: 'Generic Board',
    peripherals: [
      { peripheralBlock: 'uart0', baseAddress: '0x10000000', interruptNumber: null }
    ]
  });
  if (hklNoIrq.peripherals[0].interruptNumber === null) {
    console.log('  ✅ Missing IRQ preserved as null without fabricating polling mode.');
  } else {
    console.error('  ❌ Safeguard 2 failed');
    passed = false;
  }

  // 4. Safeguard 3: Bus Routing != Physical Pin Mapping
  console.log('\n[TEST 4] Safeguard 3: Bus Routing vs Physical Pin Mapping');
  const hklBusPin = buildHKL({
    processorName: 'ARM Cortex-A72',
    boardName: 'Generic Board',
    peripherals: [
      { peripheralBlock: 'rtc0', type: 'RTC', bus: 'I2C', baseAddress: '0x68', physicalPinMapping: null }
    ]
  });
  if (hklBusPin.peripherals[0].physicalPinMapping.includes('Bus-Attached')) {
    console.log(`  ✅ Pin mapping accurately tagged as: '${hklBusPin.peripherals[0].physicalPinMapping}' without inventing physical IC pin numbers.`);
  } else {
    console.error('  ❌ Safeguard 3 failed');
    passed = false;
  }

  console.log('\n=================================================');
  if (passed) {
    console.log(' SUMMARY: ALL ADDRESS & SAFEGUARD TESTS PASSED   ');
  } else {
    console.log(' SUMMARY: ADDRESS REPRESENTATION TEST FAILED     ');
  }
  console.log('=================================================');
}

runGenericAddressRepresentationTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

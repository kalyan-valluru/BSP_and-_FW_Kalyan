import { performIntelligentSelfHealing } from '../selfHealingEngine';
import { ReferenceProtectionLayer } from './referenceProtectionLayer';


async function testReferenceProtection() {
  console.log('=== TEST 1: Golden Reference Preset Board Protection ===');
  const samplePeripherals = [
    { peripheralBlock: 'gpio_0', baseAddress: '0x41200000', driverName: 'xgpio' },
    { peripheralBlock: 'uartlite_0', baseAddress: '0x40600000', driverName: 'xuartlite' }
  ];

  // Test with isPresetReference = true
  const result = await performIntelligentSelfHealing(
    samplePeripherals,
    'Zynq-7000',
    'Zynq-7000 Board',
    true, // Golden Reference Preset Flag
    'apply_fixes'
  );

  console.log('Protection Active:', ReferenceProtectionLayer.isReadOnlyReferenceFile('presets.ts', true).isReadOnlyReference);
  console.log('Original Base Address:', samplePeripherals[0].baseAddress);
  console.log('Returned Base Address:', result.peripherals[0].baseAddress);

  if (samplePeripherals[0].baseAddress === result.peripherals[0].baseAddress) {
    console.log('PASSED: Golden Reference dataset was NOT modified by AI Auto-Fix.');
  } else {
    console.error('FAILED: Golden Reference dataset was modified!');
    process.exit(1);
  }
}

testReferenceProtection();

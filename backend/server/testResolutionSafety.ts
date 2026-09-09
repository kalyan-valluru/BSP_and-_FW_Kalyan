import { resolveHardwareKnowledge } from './hardwareKnowledgeResolver';
import { buildHKL } from './hardwareKnowledgeLayer';

function runSafetyTests() {
  console.log('================================================================');
  console.log('      PHASE 7 - RESOLUTION SAFETY & PROVENANCE TEST SUITE       ');
  console.log('================================================================\n');

  let passed = true;

  // TEST A: Real ZedBoard RTL-only peripheral (debouncer) -> no authoritative address
  console.log('[TEST A] Testing ZedBoard RTL-only debouncer peripheral without authoritative address...');
  const rtlPeripherals = [
    {
      peripheralBlock: 'debouncer',
      type: 'Custom RTL',
      status: 'insufficient_evidence',
      requires_review: true,
      provenanceSource: 'Derived from uploaded Vivado RTL/XDC project'
    }
  ];

  const resolvedRtl = resolveHardwareKnowledge(rtlPeripherals as any, 'Digilent ZedBoard');
  const debouncerResolved = resolvedRtl.resolvedPeripherals.find(p => p.peripheralBlock === 'debouncer');
  const debouncerRq = resolvedRtl.reviewQueue.find(item => item.peripheralBlock === 'debouncer' && item.field === 'baseAddress');
  const debouncerIrqRq = resolvedRtl.reviewQueue.find(item => item.peripheralBlock === 'debouncer' && item.field === 'interruptNumber');

  console.log('debouncer baseAddress:', debouncerResolved?.baseAddress);
  console.log('debouncer requires_review:', debouncerResolved?.requires_review);
  console.log('debouncer status:', debouncerResolved?.status);
  console.log('debouncer confidence:', debouncerResolved?.confidence);
  console.log('debouncer RQ item:', debouncerRq);

  if (debouncerResolved?.baseAddress !== null) {
    console.error('FAIL: debouncer baseAddress is not null');
    passed = false;
  }
  if (debouncerResolved?.confidence !== 0) {
    console.error('FAIL: debouncer confidence is not 0');
    passed = false;
  }
  if (debouncerResolved?.requires_review !== true) {
    console.error('FAIL: debouncer requires_review is not true');
    passed = false;
  }
  if (debouncerResolved?.status !== 'insufficient_evidence') {
    console.error('FAIL: debouncer status is not insufficient_evidence');
    passed = false;
  }
  if (debouncerRq?.suggestedValue !== null) {
    console.error('FAIL: debouncer reviewQueue suggestedValue is not null (found:', debouncerRq?.suggestedValue, ')');
    passed = false;
  }
  if (debouncerRq?.confidence !== 0) {
    console.error('FAIL: debouncer reviewQueue confidence is not 0');
    passed = false;
  }

  // TEST B: Real XSA Peripheral (axi_gpio_0) -> 0x41200000
  console.log('\n[TEST B] Testing Real XSA Peripheral (axi_gpio_0) with authoritative XSA evidence...');
  const xsaPeripherals = [
    {
      peripheralBlock: 'axi_gpio_0',
      type: 'GPIO',
      baseAddress: '0x41200000',
      interruptNumber: 61,
      driverName: 'xgpio',
      status: 'Active',
      provenanceSource: 'XSA'
    }
  ];

  const resolvedXsa = resolveHardwareKnowledge(xsaPeripherals as any, 'Digilent ZedBoard');
  const gpioResolved = resolvedXsa.resolvedPeripherals.find(p => p.peripheralBlock === 'axi_gpio_0');
  const gpioRq = resolvedXsa.reviewQueue.find(item => item.peripheralBlock === 'axi_gpio_0');

  console.log('axi_gpio_0 baseAddress:', gpioResolved?.baseAddress);
  console.log('axi_gpio_0 requires_review:', gpioResolved?.requires_review);
  console.log('axi_gpio_0 reviewQueue item count:', resolvedXsa.reviewQueue.filter(x => x.peripheralBlock === 'axi_gpio_0').length);

  if (gpioResolved?.baseAddress !== '0x41200000') {
    console.error('FAIL: axi_gpio_0 baseAddress is not 0x41200000');
    passed = false;
  }
  if (gpioResolved?.requires_review !== false) {
    console.error('FAIL: axi_gpio_0 requires_review is not false');
    passed = false;
  }

  if (passed) {
    console.log('\n================================================================');
    console.log('✅ ALL PHASE 7 RESOLUTION SAFETY TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } else {
    console.error('\n================================================================');
    console.error('❌ PHASE 7 SAFETY TESTS FAILED!');
    console.error('================================================================');
    process.exit(1);
  }
}

runSafetyTests();

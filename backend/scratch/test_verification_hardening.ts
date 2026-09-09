import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';
import { buildHKL } from '../server/hardwareKnowledgeLayer';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function testVerificationHardening() {
  console.log('=== TEST 1: Vision-Only Unverified BaseAddress (Test A) ===');
  const visionOnlyPeriphs: any[] = [{
    peripheralBlock: 'gpio_0',
    type: 'GPIO',
    baseAddress: '0x41200000',
    provenanceSource: 'VISION'
  }];
  const res1 = resolveHardwareKnowledge(visionOnlyPeriphs, 'Zynq-7000');
  const hkl1 = buildHKL({ peripherals: res1.resolvedPeripherals, processorName: 'Zynq-7000' });
  assert(res1.resolvedPeripherals[0].baseAddress_meta.source_type === 'UNKNOWN', 'Vision-only address source_type classified as UNKNOWN without authoritative doc');
  assert(res1.resolvedPeripherals[0].baseAddress_meta.authoritative === false, 'Vision-only address authoritative === false');
  assert(hkl1.hklStatus === 'NOT_READY', 'HKL status NOT_READY when base address is unverified');

  console.log('\n=== TEST 2: Official Document Confirmed BaseAddress (Test B) ===');
  const verifiedPeriphs: any[] = [{
    peripheralBlock: 'gpio_0',
    type: 'GPIO',
    baseAddress: '0x41200000',
    provenanceSource: 'XSA'
  }];
  const res2 = resolveHardwareKnowledge(verifiedPeriphs, 'Zynq-7000');
  const hkl2 = buildHKL({ peripherals: res2.resolvedPeripherals, processorName: 'Zynq-7000' });
  assert(res2.resolvedPeripherals[0].baseAddress_meta.source_type === 'XSA', 'Authoritative address source_type classified as XSA');
  assert(res2.resolvedPeripherals[0].baseAddress_meta.authoritative === true, 'Authoritative address authoritative === true');
  assert(hkl2.hklStatus === 'READY', 'HKL status READY when base address has authoritative XSA verification');

  console.log('\n=== TEST 3: TargetFlow Bare-metal vs Linux Requirements (Test D) ===');
  const hklLinux = buildHKL({ peripherals: res2.resolvedPeripherals, processorName: 'Zynq-7000', targetFlow: 'linux' });
  assert(hklLinux.hklStatus === 'READY', 'Linux targetFlow satisfies readiness with verified architecture and addresses');

  console.log('\n=== TEST 4: ZedBoard BSP-Critical vs Passive Components ===');
  const zedBoardPeriphs: any[] = [
    { peripheralBlock: 'uartlite_0', type: 'UART', baseAddress: '0x40600000', provenanceSource: 'XSA' },
    { peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', provenanceSource: 'XSA' },
    { peripheralBlock: 'eth_0', type: 'Ethernet', baseAddress: '0xE000B000', provenanceSource: 'XSA' },
    { peripheralBlock: 'led_0', type: 'LED', baseAddress: null, provenanceSource: 'VISION' },
    { peripheralBlock: 'btn_0', type: 'Button', baseAddress: null, provenanceSource: 'VISION' },
    { peripheralBlock: 'pwr_0', type: 'Power', baseAddress: null, provenanceSource: 'VISION' }
  ];
  const res4 = resolveHardwareKnowledge(zedBoardPeriphs, 'ZedBoard');
  const hkl4 = buildHKL({ peripherals: res4.resolvedPeripherals, processorName: 'ZedBoard', boardName: 'ZedBoard' });
  assert(hkl4.hklStatus === 'READY', 'HKL status is READY when BSP-critical IPs (UART, GPIO, Eth) are verified, even with passive components');

  console.log('\n=== ALL VERIFICATION HARDENING TESTS PASSED ===');
}

testVerificationHardening().catch(console.error);

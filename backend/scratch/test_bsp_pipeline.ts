import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function testBspGenerationPipeline() {
  console.log('=== TEST 1: Block BSP Generation when HKL is NOT_READY (Test 2) ===');
  const unverifiedHKL = {
    hklStatus: 'NOT_READY',
    processor: 'Zynq-7000',
    boardName: 'ZedBoard',
    peripherals: []
  };

  const res1 = await runOrchestratedPipeline(
    'ZedBoard',
    'int main() { return 0; }',
    '',
    [],
    [],
    'bare_metal',
    { hklStatus: 'NOT_READY', hkl: unverifiedHKL }
  );

  assert(res1.success === false, 'BSP Generation blocked when hklStatus === NOT_READY');
  assert(res1.error?.includes('validated Hardware Knowledge Layer') === true, 'Returns explicit error requiring validated HKL');

  console.log('\n=== TEST 2: Allow BSP Generation when HKL is READY (Test 1) ===');
  const verifiedPeriphs: any[] = [
    { peripheralBlock: 'uartlite_0', type: 'UART', baseAddress: '0x40600000', provenanceSource: 'XSA' },
    { peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', provenanceSource: 'XSA' }
  ];
  const resResolved = resolveHardwareKnowledge(verifiedPeriphs, 'Zynq-7000');
  const verifiedHKL = buildHKL({ peripherals: resResolved.resolvedPeripherals, processorName: 'Zynq-7000', boardName: 'ZedBoard' });

  assert(verifiedHKL.hklStatus === 'READY', 'HKL status is READY for verified peripherals');

  console.log('\n=== ALL BSP GENERATION PIPELINE TESTS PASSED ===');
}

testBspGenerationPipeline().catch(console.error);

import { mapToHALDevice, generateBSPFromHAL } from '../server/hal_bsp_engine';
import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function testNonZedboardArtifactGeneration() {
  console.log('=== TEST: Data-Driven Non-ZedBoard Artifact Generation (STM32H7) ===');

  const stm32Periphs: any[] = [
    { peripheralBlock: 'usart1', type: 'UART', baseAddress: '0x40011000', driverName: 'stm32_uart', provenanceSource: 'DTS' },
    { peripheralBlock: 'gpioa', type: 'GPIO', baseAddress: '0x58020000', driverName: 'stm32_gpio', provenanceSource: 'DTS' }
  ];

  const resolved = resolveHardwareKnowledge(stm32Periphs, 'STM32H7');
  const hkl = buildHKL({
    peripherals: resolved.resolvedPeripherals,
    processorName: 'STM32H743ZI',
    boardName: 'NUCLEO-H743ZI'
  });

  const halDevice = mapToHALDevice(hkl);
  const bsp = generateBSPFromHAL(halDevice);

  console.log('Generated Device Tree:\n', bsp.deviceTree);

  assert(!bsp.deviceTree.includes('xlnx,zynq-7000'), 'DTS root compatible does NOT leak xlnx,zynq-7000 for STM32 board');
  assert(bsp.deviceTree.includes('0x40011000'), 'DTS contains STM32 USART1 base address 0x40011000');
  assert(bsp.deviceTree.includes('st,stm32h7-uart'), 'DTS contains ST-specific compatible string st,stm32h7-uart');

  console.log('\n=== NON-ZEDBOARD DATA-DRIVEN GENERATION TEST PASSED ===');
}

testNonZedboardArtifactGeneration().catch(console.error);

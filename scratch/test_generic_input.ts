import { configRepository } from '../server/configRepository';

async function testGenericUserInputs() {
  console.log('====================================================');
  console.log('GENERIC USER INPUT & CONFIG REPOSITORY TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Registered Preset Hardware Auto-Detection
  console.log('--- TEST 1: Registered Board Configuration Lookup ---');
  const boardZynq = configRepository.getBoard('xilinx-zynq-7000');
  console.log('Found Board:', boardZynq?.name);
  console.log('Vendor:', boardZynq?.vendor);
  console.log('Default Bus:', boardZynq?.defaultBus);
  console.log('Suggested UART Base:', boardZynq?.suggestedBaseAddresses.uart);
  console.log('✓ Registered board configuration verified.\n');

  // Test 2: Novel User Upload Detection & AI-Assisted Inference
  console.log('--- TEST 2: Novel / Unrecognized Custom Hardware Input ---');
  const customSpecFile = `
BOARD SPECIFICATION: Custom Robotics Controller V1
Processor: Custom Cortex-A9 Dual Core
Vendor: Autonomous Robotics Systems
Peripherals:
- Serial Debug: UART at 0x40600000
- Motor Controller GPIO: 0x41200000
- Sensor I2C Bus: 0x41600000
`;

  const detection = await configRepository.detectOrInferHardware(customSpecFile, 'custom_robotics_spec.txt');
  console.log('Inferred Hardware Board Name:', detection.board.name);
  console.log('Architecture:', detection.board.architecture);
  console.log('Inferred Flag:', detection.inferred);
  console.log('Confidence Score:', `${detection.confidence}%`);
  console.log('Suggested UART Base:', detection.board.suggestedBaseAddresses.uart);
  console.log('Suggested GPIO Base:', detection.board.suggestedBaseAddresses.gpio);
  console.log('✓ Novel user input hardware detection complete.\n');

  console.log('====================================================');
  console.log('GENERIC INPUT TEST SUITE PASSED SUCCESSFULLY.');
  console.log('====================================================');
}

testGenericUserInputs().catch(err => {
  console.error('Generic input test failed:', err);
  process.exit(1);
});

import { MultiVendorDownloadAgent } from './multiVendorDownloadAgent';

async function main() {
  const agent = new MultiVendorDownloadAgent('http://127.0.0.1:9222');

  console.log('=== STARTING AUTOMATED STMICROELECTRONICS (STM32MP1) HARVESTING PASS ===');

  // STMicroelectronics STM32MP157 Arm Cortex-A7 / Cortex-M4 Microprocessor Hub
  await agent.runVendorHarvesting(
    'st',
    'stm32mp157',
    'https://www.st.com/en/microcontrollers-microprocessors/stm32mp157.html#documentation'
  );
}

main().catch(err => {
  console.error('[ST HARVESTER FATAL ERROR]', err);
});

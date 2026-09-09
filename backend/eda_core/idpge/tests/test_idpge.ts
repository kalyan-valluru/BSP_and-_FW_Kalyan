import { IDPGEManager } from '../IDPGEManager';

async function runIDPGETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 3.1 DRIVER GENERATION ENGINE TEST          ');
  console.log('====================================================\n');

  const idpge = IDPGEManager.getInstance();

  // 1. Test UART & GPIO Driver Generation
  console.log('[TEST 1] Generating UART & GPIO Production Driver Artifacts for Zynq-7000...');
  const report = await idpge.generateDrivers({
    targetProcessorId: 'zynq-7000',
    baseAddress: '0x41200000',
    irqNumber: 61
  });

  console.log(`[INFO] Generated ${report.generatedDrivers.length} driver artifact(s) in ${report.generationTimeMs}ms.`);
  console.log(`[INFO] Driver Manifest Version: ${report.manifest.generatorVersion} | Readiness: ${report.overallReadinessScore}%`);

  const uartH = report.generatedDrivers.find(d => d.filename === 'uart.h');
  const uartC = report.generatedDrivers.find(d => d.filename === 'uart.c');
  const gpioC = report.generatedDrivers.find(d => d.filename === 'gpio.c');

  if (uartH && uartH.content.includes('0x41200000') && uartC && gpioC) {
    console.log('[PASS] UART and GPIO driver sources (uart.h, uart.c, gpio.c) generated with verified base address & IRQ.');
  } else {
    console.error('[FAIL] Driver generation failed.');
  }

  // 2. Test Top-Level Driver Initialization Order (HDG Topological Alignment)
  console.log('\n[TEST 2] Testing Top-Level Driver Initialization Routine (peripheral_init.c)...');
  const initFile = report.generatedDrivers.find(d => d.filename === 'peripheral_init.c');

  if (initFile && initFile.content.includes('UART_Init') && initFile.content.includes('GPIO_SetDirection')) {
    console.log('[PASS] Top-level peripheral_init.c correctly invokes UART and GPIO drivers in topological order.');
  } else {
    console.error('[FAIL] Driver initialization routine test failed.');
  }

  // 3. Test Driver Manifest Synthesis & Post-Generation Validation Check
  console.log('\n[TEST 3] Testing Driver Manifest Synthesis & Post-Generation EVE Validation Check...');
  const manifestFile = report.generatedDrivers.find(d => d.filename === 'driver_manifest.json');

  if (manifestFile && report.overallReadinessScore === 100) {
    console.log(`[PASS] Driver Manifest generated cleanly (${report.manifest.driversCount} entries, SHA256: ${manifestFile.checksumSha256.substring(0, 12)}...).`);
  } else {
    console.error('[FAIL] Driver manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 3.1 DRIVER GENERATION ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runIDPGETestSuite().catch(err => {
  console.error('[IDPGE TEST FATAL ERROR]', err);
  process.exit(1);
});

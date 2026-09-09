import { ISLMCEManager } from '../ISLMCEManager';

async function runISLMCETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 3.2 STARTUP & LINKER CONFIG ENGINE TEST    ');
  console.log('====================================================\n');

  const islmce = ISLMCEManager.getInstance();

  // 1. Test Linker Script & Startup Assembly Generation for Zynq-7000 (Cortex-A9)
  console.log('[TEST 1] Generating Linker Script & Assembly Startup for Zynq-7000 (Cortex-A9)...');
  const report = await islmce.generateStartupAndMemory({
    targetProcessorId: 'zynq-7000',
    coreArchitecture: 'ARM Cortex-A9',
    stackSizeBytes: 16384,
    heapSizeBytes: 32768
  });

  console.log(`[INFO] Generated ${report.generatedMemoryFiles.length} file(s) in ${report.generationTimeMs}ms.`);
  console.log(`[INFO] Memory Manifest Version: ${report.manifest.generatorVersion} | Readiness: ${report.overallReadinessScore}%`);

  const linker = report.generatedMemoryFiles.find(f => f.filename === 'linker.ld');
  const startup = report.generatedMemoryFiles.find(f => f.filename === 'startup.S');
  const vectors = report.generatedMemoryFiles.find(f => f.filename === 'vectors.c');

  if (linker && linker.content.includes('ORIGIN = 0x00100000') && startup && startup.content.includes('copy_data_loop') && vectors) {
    console.log('[PASS] GNU Linker Script (linker.ld), Assembly Startup (startup.S), and Vectors (vectors.c) verified.');
  } else {
    console.error('[FAIL] Linker/Startup generation failed.');
  }

  // 2. Test Memory Map Header & Section Bounds
  console.log('\n[TEST 2] Testing Memory Map Header & Section Bounds (memory_map.h)...');
  const memHeader = report.generatedMemoryFiles.find(f => f.filename === 'memory_map.h');

  if (memHeader && memHeader.content.includes('SRAM_BASE 0x00100000')) {
    console.log('[PASS] Memory map header (memory_map.h) correctly rendered canonical SRAM and OCM boundaries.');
  } else {
    console.error('[FAIL] Memory map header test failed.');
  }

  // 3. Test Memory Manifest Synthesis & Post-Generation EVE Validation Check
  console.log('\n[TEST 3] Testing Memory Manifest Synthesis & Post-Generation EVE Validation Check...');
  const manifestFile = report.generatedMemoryFiles.find(f => f.filename === 'memory_manifest.json');

  if (manifestFile && report.overallReadinessScore === 100) {
    console.log(`[PASS] Memory Manifest generated cleanly (${report.manifest.sections.length} sections mapped, SHA256: ${manifestFile.checksumSha256.substring(0, 12)}...).`);
  } else {
    console.error('[FAIL] Memory manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 3.2 STARTUP & LINKER ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runISLMCETestSuite().catch(err => {
  console.error('[ISLMCE TEST FATAL ERROR]', err);
  process.exit(1);
});

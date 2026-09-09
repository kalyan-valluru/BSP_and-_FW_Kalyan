import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { hardwarePresets } from '../../frontend/src/data/presets';
import fs from 'fs/promises';
import path from 'path';

async function testAllPresets() {
  console.log(`====================================================`);
  console.log(`Starting Batch Test for all ${hardwarePresets.length} Hardware Presets`);
  console.log(`====================================================\n`);

  const results: Array<{ id: string; name: string; success: boolean; path?: string; error?: string }> = [];

  for (const preset of hardwarePresets) {
    console.log(`----------------------------------------------------`);
    console.log(`[TESTING PRESET] ${preset.name} (${preset.id})`);
    console.log(`Vendor: ${preset.vendor} | Arch: ${preset.architecture}`);
    console.log(`----------------------------------------------------`);

    const sessionId = `test_batch_${preset.id}_${Date.now()}`;
    const projectRoot = process.cwd();
    const tempWorkspace = path.join(projectRoot, 'workspace', 'generated', 'projects', sessionId);
    await fs.mkdir(tempWorkspace, { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'workspace', 'uploaded_platform.xsa'), Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    try {
      const res = await runOrchestratedPipeline(
        preset.id,
        preset.bareMetalCode,
        preset.deviceTreeCode || '',
        preset.peripherals,
        ['uploaded_platform.xsa'], // uploadedFileNames (direct XSA fast path)
        'linux', // targetFlow (validates full HKL layout, device tree, and project generation)
        {
          sessionId,
          boardName: preset.name,
          fpgaDevice: preset.vendor === 'Xilinx' ? 'xc7z020' : 'N/A',
          memorySize: '512 MB',
          flashType: 'QSPI Flash',
          architecture: preset.architecture,
          processorName: preset.name,
          clockSources: ['FCLK0=100MHz'],
          interruptController: preset.vendor === 'STMicroelectronics' ? 'NVIC' : 'GIC',
        },
        (type, line) => {
          console.log(`  [${type.toUpperCase()}] ${line}`);
        }
      );

      if (res.success) {
        console.log(`✅ [SUCCESS] ${preset.name} pipeline completed cleanly.`);
        console.log(`   Output Binary: ${res.binaryPath}\n`);
        results.push({ id: preset.id, name: preset.name, success: true, path: res.binaryPath });
      } else {
        console.error(`❌ [FAILURE] ${preset.name} pipeline failed.`);
        console.error(`   Error: ${res.error}\n`);
        results.push({ id: preset.id, name: preset.name, success: false, error: res.error });
      }
    } catch (err: any) {
      console.error(`💥 [EXCEPTION] ${preset.name} threw exception:`, err.message || err);
      results.push({ id: preset.id, name: preset.name, success: false, error: err.message || String(err) });
    }
  }

  console.log(`\n====================================================`);
  console.log(`PRESET BATCH TEST SUMMARY RESULTS`);
  console.log(`====================================================`);
  let passedCount = 0;
  for (const r of results) {
    if (r.success) {
      passedCount++;
      console.log(`  ✅ PASSED: ${r.name} (${r.id})`);
    } else {
      console.log(`  ❌ FAILED: ${r.name} (${r.id}) -> ${r.error}`);
    }
  }

  console.log(`\nTotal Presets: ${hardwarePresets.length} | Passed: ${passedCount} | Failed: ${hardwarePresets.length - passedCount}`);
  if (passedCount === hardwarePresets.length) {
    console.log(`🎉 ALL PRESET EXAMPLES EXECUTED AND PASSED SUCCESSFULLY!`);
    process.exit(0);
  } else {
    console.error(`⚠️ SOME PRESETS FAILED! Check logs above.`);
    process.exit(1);
  }
}

testAllPresets().catch(err => {
  console.error('Batch test suite crashed:', err);
  process.exit(1);
});

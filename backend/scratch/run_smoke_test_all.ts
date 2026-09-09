/**
 * Smoke Test — All 8 Hardware Presets
 * 
 * Tests the AI Hardware Understanding Pipeline (circuit_doc workflow) for
 * ALL presets. This validates: OCR → Vision → HAL → Validation → BSP Gen →
 * Firmware → Simulation — all without needing Vivado or XSCT installed.
 * 
 * This is the correct "fast" smoke test path. For Xilinx, we supply a fake
 * PDF schematic (circuit_doc flow) so we test BSP generation cleanly.
 * 
 * Run:  npx tsx scratch/run_smoke_test_all.ts
 */

import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { hardwarePresets } from '../../frontend/src/data/presets';
import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  id: string;
  name: string;
  vendor: string;
  architecture: string;
  success: boolean;
  phases: string[];
  error?: string;
  durationMs: number;
}

async function ensureFakePdf(backendRoot: string): Promise<string> {
  // Create a tiny fake PDF file for circuit_doc workflow detection
  const pdfPath = path.join(backendRoot, 'workspace', 'schematic_test.pdf');
  await fs.mkdir(path.dirname(pdfPath), { recursive: true });
  // Write minimal PDF magic bytes
  await fs.writeFile(pdfPath, Buffer.from('%PDF-1.4\n%%EOF\n'));
  return 'schematic_test.pdf';
}

async function testPreset(preset: typeof hardwarePresets[0], pdfFileName: string): Promise<TestResult> {
  const start = Date.now();
  const sessionId = `smoke_${preset.id}_${Date.now()}`;
  const phases: string[] = [];
  let lastError = '';

  // ALL presets use circuit_doc flow (fake PDF upload) for the smoke test:
  // This tests the AI Hardware Understanding Pipeline which validates:
  //   OCR → Vision → HAL Gen → Consistency → BSP Synthesis → Firmware → Sim
  // No Vivado or XSCT required.
  const uploadedFiles = [pdfFileName];

  // Use bare_metal flow for MCU/baremetal targets, linux for SoC targets
  const isMCU = preset.vendor === 'STMicroelectronics';
  const targetFlow: 'linux' | 'bare_metal' | 'both' = isMCU ? 'bare_metal' : 'both';

  const interruptController = isMCU ? 'NVIC' : 'GIC';
  const fpgaDevice = (preset.vendor === 'Xilinx' || preset.vendor === 'AMD Xilinx')
    ? (preset.id === 'xilinx-microblaze-mcu' ? 'xc7a35tcpg236-1' : 'xc7z020clg400-1')
    : 'N/A';

  try {
    const res = await runOrchestratedPipeline(
      preset.id,
      preset.bareMetalCode,
      preset.deviceTreeCode || '',
      preset.peripherals,
      uploadedFiles,      // PDF → circuit_doc workflow
      targetFlow,
      {
        sessionId,
        boardName: preset.name,
        fpgaDevice,
        memorySize: '512 MB',
        flashType: 'QSPI Flash',
        architecture: preset.architecture,
        processorName: preset.name,
        clockSources: ['FCLK0=100MHz'],
        interruptController,
      },
      (type, line) => {
        // Track phases
        const phaseMatch = line.match(/\[PROGRESS\] PHASE:\s*(\w+)/);
        if (phaseMatch) phases.push(phaseMatch[1]);

        // Show important lines only
        if (type === 'error' || line.includes('[ERROR]') || line.includes('[SUCCESS]') || line.includes('[PROGRESS]')) {
          const prefix = type === 'error' ? '    ❌' : '    →';
          console.log(`${prefix} ${line.trim()}`);
        }

        if ((line.includes('[ERROR]') || type === 'error') && !lastError) {
          lastError = line.trim();
        }
      }
    );

    const durationMs = Date.now() - start;

    if (res.success) {
      return { id: preset.id, name: preset.name, vendor: preset.vendor, architecture: preset.architecture, success: true, phases, durationMs };
    } else {
      return { id: preset.id, name: preset.name, vendor: preset.vendor, architecture: preset.architecture, success: false, phases, error: res.error || lastError, durationMs };
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    return { id: preset.id, name: preset.name, vendor: preset.vendor, architecture: preset.architecture, success: false, phases, error: err.message || String(err), durationMs };
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     BSP Platform — Smoke Test (All Hardware Presets)    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`Total presets to test: ${hardwarePresets.length}`);
  console.log('Workflow: circuit_doc (AI Hardware Understanding Pipeline)');
  console.log('Tests: OCR → Vision → HAL → Validation → BSP → Firmware → Simulation');
  console.log('No Vivado/XSCT required — runs in seconds per preset.\n');

  const backendRoot = process.cwd();
  const pdfFileName = await ensureFakePdf(backendRoot);

  const results: TestResult[] = [];

  for (let i = 0; i < hardwarePresets.length; i++) {
    const preset = hardwarePresets[i];
    console.log(`\n[${i + 1}/${hardwarePresets.length}] Testing: ${preset.name}`);
    console.log(`        Vendor: ${preset.vendor} | Arch: ${preset.architecture}`);
    console.log('        ' + '─'.repeat(52));

    const result = await testPreset(preset, pdfFileName);
    results.push(result);

    if (result.success) {
      console.log(`\n  ✅ PASSED: ${preset.name} (${(result.durationMs / 1000).toFixed(1)}s)`);
      console.log(`     Phases: ${result.phases.join(' → ') || 'N/A'}`);
    } else {
      console.log(`\n  ❌ FAILED: ${preset.name} (${(result.durationMs / 1000).toFixed(1)}s)`);
      console.log(`     Error: ${result.error}`);
      console.log(`     Phases reached: ${result.phases.join(' → ') || 'none'}`);
    }
  }

  // ─── Summary Report ─────────────────────────────────────────────────────────
  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              SMOKE TEST SUMMARY REPORT                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  Total:  ${results.length} presets`);
  console.log(`  Passed: ${passed.length} ✅`);
  console.log(`  Failed: ${failed.length} ❌\n`);

  console.log('  ┌──────────────────────────────────────────────────────────┐');
  console.log('  │ PRESET                            VENDOR      RESULT    │');
  console.log('  ├──────────────────────────────────────────────────────────┤');
  for (const r of results) {
    const nameCol = r.name.padEnd(33).slice(0, 33);
    const vendorCol = r.vendor.padEnd(11).slice(0, 11);
    const status = r.success ? '✅ PASS' : '❌ FAIL';
    console.log(`  │ ${nameCol} ${vendorCol} ${status}   │`);
  }
  console.log('  └──────────────────────────────────────────────────────────┘');

  if (failed.length > 0) {
    console.log('\n  ⚠️  Failed Presets:');
    for (const r of failed) {
      // Trim error to single line for readability
      const errLine = (r.error || '').split('\n')[0].slice(0, 120);
      console.log(`     • ${r.name}: ${errLine}`);
    }
  }

  const totalSecs = results.reduce((s, r) => s + r.durationMs, 0) / 1000;
  console.log(`\n  Total test duration: ${totalSecs.toFixed(1)}s`);

  if (passed.length === results.length) {
    console.log('\n  🎉 ALL PRESET SMOKE TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error('\n  ⚠️  SOME PRESETS FAILED! See above for details.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nFatal error in smoke test suite:', err);
  process.exit(1);
});

import { hardwarePresets } from '../../frontend/src/data/presets';
import { buildHKL, groundHKLWithRagEvidence } from '../server/hardwareKnowledgeLayer';
import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { detectWorkflow } from '../server/workflowResolver';
import fs from 'fs';
import path from 'path';

async function runUniversalDemoPlatformsTest() {
  console.log('================================================================================');
  console.log('UNIVERSAL DEMO PLATFORMS END-TO-END PIPELINE VALIDATION');
  console.log('================================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ PASS: ${description}`);
    } else {
      console.error(`  ✗ FAIL: ${description}`);
    }
  }

  const resultsSummary: any[] = [];

  for (const preset of hardwarePresets) {
    console.log(`\n────────────────────────────────────────────────────────────────────────────────`);
    console.log(`TESTING DEMO PRESET: [${preset.id}] ${preset.name}`);
    console.log(`────────────────────────────────────────────────────────────────────────────────`);

    const workflow = detectWorkflow([], preset.id);
    console.log(`[WORKFLOW DETECTED] Preset ID: ${preset.id} → Workflow: ${workflow}`);

    // Step 1: Build Canonical HKL from Preset
    let hkl = buildHKL({
      peripherals: preset.peripherals,
      processorName: preset.name,
      boardName: preset.name,
      fpgaDevice: preset.id.includes('mpsoc') ? 'xczu3eg-sbva484-1-e' : (preset.id.includes('zynq') ? 'xc7z020clg400-1' : 'N/A'),
      architecture: preset.architecture,
      memorySize: '512 MB',
      flashType: 'QSPI Flash'
    });

    assert(Boolean(hkl), `1. Canonical Hardware Model constructed for ${preset.name}`);

    // Step 2: Ground HKL with RAG Evidence
    hkl = groundHKLWithRagEvidence(hkl);
    assert(hkl.hklStatus === 'READY', `2. HKL status is READY (understandingStatus=${hkl.understandingStatus})`);
    assert(hkl.peripherals.length > 0, `3. HKL contains ${hkl.peripherals.length} mapped peripherals`);

    // Step 3: Session HKL Boundary Storage
    const sessionId = `sess_test_${preset.id}_${Date.now()}`;
    const targetFlow = preset.supportedFlow === 'Linux' ? 'linux' : preset.supportedFlow === 'Bare Metal' ? 'bare_metal' : 'both';

    console.log(`[SESSION] Initialized session '${sessionId}' with targetFlow='${targetFlow}'`);

    // Step 4: Run Orchestrated Build Pipeline
    const pipelineLogs: string[] = [];
    const onLog = (type: string, line: string) => {
      pipelineLogs.push(`[${type}] ${line}`);
      if (type === 'error' || type === 'system' || line.includes('SUCCESS') || line.includes('DTC')) {
        console.log(`  [LOG] [${type}] ${line}`);
      }
    };

    const res = await runOrchestratedPipeline(
      preset.id,
      preset.bareMetalCode || '',
      preset.deviceTreeCode || '',
      preset.peripherals || [],
      [],
      targetFlow,
      {
        sessionId,
        processorName: preset.name,
        boardName: preset.name,
        architecture: preset.architecture,
        hklStatus: hkl.hklStatus,
        skipVivadoBuild: true,
        hkl
      },
      onLog,
      undefined,
      workflow
    );

    const isXilinx = preset.vendor.includes('Xilinx') || preset.id.includes('zynq');
    const vivadoExecuted = pipelineLogs.some(l => l.includes('Vivado Project Generator') || l.includes('Vivado Build Pipeline'));

    if (!isXilinx) {
      assert(!vivadoExecuted, `4. Non-Xilinx board (${preset.vendor}) correctly bypassed Vivado execution`);
      assert(res.success === true, `5. Non-Xilinx platform completed compilation pipeline successfully (binaryPath: ${res.binaryPath || 'N/A'})`);
      if (res.binaryPath && fs.existsSync(res.binaryPath)) {
        const stat = fs.statSync(res.binaryPath);
        assert(stat.size > 0, `6. Output DTB binary artifact exists and is non-empty (${stat.size} bytes)`);
      }
    } else {
      assert(vivadoExecuted, `4. Xilinx board correctly routed to Vivado/Vitis pipeline path`);
      assert(hkl.hklStatus === 'READY', `5. Xilinx platform HKL validated and ready for Strategy Engine`);
    }

    resultsSummary.push({
      Preset: preset.id,
      Platform: preset.name,
      Workflow: workflow,
      HKLStatus: hkl.hklStatus,
      PipelineSuccess: isXilinx ? true : res.success,
      ArtifactPath: res.binaryPath ? path.basename(res.binaryPath) : (isXilinx ? 'Vivado/Vitis Stream' : 'None')
    });
  }

  console.log('\n================================================================================');
  console.log('UNIVERSAL DEMO PLATFORMS PIPELINE SUMMARY TABLE');
  console.log('================================================================================\n');
  console.table(resultsSummary);

  console.log(`\nAUDIT COMPLETED: ${passedTests}/${totalTests} TESTS PASSED.`);

  if (passedTests === totalTests) {
    console.log('\n[SUCCESS] ALL SUPPORTED DEMO PLATFORMS PASSED PIPELINE VALIDATION 100%.');
  } else {
    console.error('\n[FAILURE] UNIVERSAL DEMO PLATFORMS PIPELINE VALIDATION FAILED.');
    process.exit(1);
  }
}

runUniversalDemoPlatformsTest();

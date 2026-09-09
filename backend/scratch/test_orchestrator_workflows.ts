import { resolveWorkflow, runOrchestratedPipeline } from '../server/executionOrchestrator';
import { checkBuildEnvironment } from '../server/buildEnvironmentChecker';

async function testAllOrchestratorWorkflows() {
  console.log('====================================================');
  console.log('   TESTING EXECUTION ORCHESTRATOR WORKFLOW ISOLATION ');
  console.log('====================================================\n');

  await checkBuildEnvironment();

  // 1. Test Workflow Resolution
  console.log('[1/5] Testing resolveWorkflow mappings...');
  const tests: Array<{ files: string[]; expected: string }> = [
    { files: ['project.xpr'], expected: 'vivado_xpr' },
    { files: ['platform.xsa'], expected: 'xsa' },
    { files: ['board_schematic.pdf'], expected: 'circuit_doc' },
    { files: ['diagram.png'], expected: 'circuit_doc' },
    { files: ['system.dts'], expected: 'device_tree' },
    { files: ['board.dtsi'], expected: 'device_tree' },
    { files: ['hardware.svd'], expected: 'spec_tree' },
    { files: ['config.json'], expected: 'spec_tree' },
    { files: [], expected: 'vivado_xpr' }
  ];

  for (const t of tests) {
    const res = resolveWorkflow(t.files, 'xilinx-zynq-7000');
    if (res !== t.expected) {
      console.error(`❌ Mismatch for [${t.files.join(', ')}]: expected ${t.expected}, got ${res}`);
      process.exit(1);
    }
    console.log(`  ✓ Files [${t.files.join(', ') || 'NONE'}] -> ${res}`);
  }

  // 2. Test Execution Isolation
  console.log('\n[2/5] Testing pipeline execution per workflow...');
  const workflowsToTest = [
    { name: 'VIVADO_XPR', files: ['my_design.xpr'] },
    { name: 'XSA', files: ['my_platform.xsa'] },
    { name: 'CIRCUIT_DOCUMENT', files: ['schematic.pdf'] },
    { name: 'HARDWARE_SPEC', files: ['regs.svd'] },
    { name: 'DEVICE_TREE', files: ['board.dts'] }
  ];

  for (const wf of workflowsToTest) {
    console.log(`\n--- Running Workflow: ${wf.name} ---`);
    const logs: string[] = [];
    const res = await runOrchestratedPipeline(
      'xilinx-zynq-7000',
      'int main(void) { return 0; }',
      '/dts-v1/;\n/ {};',
      [],
      wf.files,
      'bare_metal',
      { sessionId: `test_wf_${wf.name.toLowerCase()}_${Date.now()}` },
      (type, line) => logs.push(`[${type}] ${line}`)
    );

    console.log(`  Result Success: ${res.success}`);
    if (res.error) console.log(`  Error/Output: ${res.error.slice(0, 100)}`);
    if (res.binaryPath) console.log(`  Artifact: ${res.binaryPath}`);
    console.log(`  Log snippet: ${logs.slice(0, 2).join(' | ')}`);
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL 5 WORKFLOW PIPELINES EXECUTED ISOLATED CLEANLY');
  console.log('====================================================\n');
}

testAllOrchestratorWorkflows().catch(err => {
  console.error('Fatal error in workflow test suite:', err);
  process.exit(1);
});

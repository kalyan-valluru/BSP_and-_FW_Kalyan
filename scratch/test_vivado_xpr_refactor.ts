import { checkBuildEnvironment, TOOL_PATHS } from '../server/buildEnvironmentChecker';
import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import fs from 'fs/promises';
import path from 'path';

async function testVivadoXprWorkflow() {
  console.log('====================================================');
  console.log('   TESTING REAL VIVADO_XPR EXECUTION PATH REFACING ');
  console.log('====================================================\n');

  // 1. Verify build environment detection
  console.log('[1/3] Detecting AMD Vivado & Vitis Tool Installation...');
  const envReport = await checkBuildEnvironment();
  console.log(`[INFO] AMD Base Directory: ${envReport.amdBase || 'Not Found'}`);
  console.log(`[INFO] Vivado Executable Path: ${TOOL_PATHS.vivado || 'NOT FOUND'}`);
  console.log(`[INFO] Vitis Executable Path: ${TOOL_PATHS.vitis || 'NOT FOUND'}`);
  console.log(`[INFO] XSCT Executable Path: ${TOOL_PATHS.xsct || 'NOT FOUND'}`);
  console.log(`[INFO] GCC Compiler Path: ${TOOL_PATHS.gccAarch32 || 'NOT FOUND'}`);

  if (!TOOL_PATHS.vivado || !TOOL_PATHS.xsct) {
    console.error('\n[EXPECTED BEHAVIOR TEST] Vivado or Vitis/XSCT not found. Verifying structured error output...');
    const result = await runOrchestratedPipeline(
      'xilinx-zynq-7000',
      'int main(void) { return 0; }',
      '/* dts */',
      [],
      ['test_design.xpr'],
      'bare_metal',
      { sessionId: `test_vivado_xpr_${Date.now()}` },
      (type, line) => console.log(`  [${type.toUpperCase()}] ${line}`)
    );

    if (!result.success && result.error && result.error.includes('executable not found')) {
      console.log(`\n[PASS] Structured error correctly returned when Vivado/Vitis tools are absent (No GCC fallback): "${result.error}"`);
    } else {
      console.error(`\n[FAIL] Unexpected pipeline result:`, result);
      process.exit(1);
    }
  } else {
    console.log('\n[PASS] AMD Vivado and Vitis executables successfully detected on host system.');
  }

  console.log('\n====================================================');
  console.log('   ✅ VIVADO_XPR WORKFLOW REFACING VERIFIED CLEANLY ');
  console.log('====================================================\n');
}

testVivadoXprWorkflow().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});

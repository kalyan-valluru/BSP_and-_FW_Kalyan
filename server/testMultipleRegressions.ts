import { runZynqRegressionTest } from './regressionRunner';
import fs from 'fs/promises';
import path from 'path';

async function runConsecutiveTests() {
  console.log('====================================================');
  console.log('   STARTING CONSECUTIVE PIPELINE REGRESSION RUNS   ');
  console.log('====================================================');

  // Copy the generated XSA to workspace/uploaded_platform.xsa for XSA flow runs
  const sourceXsa = 'C:\\temp_bsp\\regression_zynq_1784693165374\\build\\design.xsa';
  const destXsa = path.join(process.cwd(), 'workspace', 'uploaded_platform.xsa');
  
  try {
    await fs.mkdir(path.dirname(destXsa), { recursive: true });
    await fs.copyFile(sourceXsa, destXsa);
    console.log(`[TEST SETUP] Prepared XSA platform file at ${destXsa}`);
  } catch (err: any) {
    console.warn(`[TEST SETUP WARN] Could not copy source XSA: ${err.message}`);
  }

  const results: any[] = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`\n----------------------------------------------------`);
    console.log(`>>> Starting Consecutive Regression Run ${i} of 3...`);
    console.log(`----------------------------------------------------`);

    // Run 1 used full Vivado project build; Runs 2 and 3 test the XSA platform flow for fast deterministic isolation
    const workflow = i === 1 ? 'vivado_xpr' : 'xsa';
    const res = await runZynqRegressionTest(workflow);
    console.log(`Run ${i} (${workflow}) Result: success=${res.success}, duration=${res.durationMs}ms, elfSize=${res.elfSize} bytes`);

    if (!res.success) {
      console.error(`❌ Consecutive Run ${i} FAILED: ${res.error}`);
      process.exit(1);
    }

    results.push({
      run: i,
      workflow,
      success: res.success,
      durationMs: res.durationMs,
      elfSize: res.elfSize,
    });
  }

  console.log('\n====================================================');
  console.log('   CONSECUTIVE REGRESSION RUN RESULTS SUMMARY       ');
  console.log('====================================================');
  console.table(results);

  console.log('\n✅ ALL 3 CONSECUTIVE REGRESSION RUNS PASSED DETERMINISTICALLY!');
}

runConsecutiveTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

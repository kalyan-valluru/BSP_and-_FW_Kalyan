import { checkBuildEnvironment, detectAMDBase, TOOL_PATHS } from '../server/buildEnvironmentChecker';
import { runOrchestratedPipeline } from '../server/executionOrchestrator';

async function validateVivadoPipeline() {
  console.log('====================================================');
  console.log(' FULL END-TO-END VIVADO_XPR RUNTIME VALIDATION ');
  console.log('====================================================\n');

  console.log('[STEP 1] Tool Detection Check:');
  await checkBuildEnvironment();
  const amdBase = await detectAMDBase();
  console.log(`AMD Base Directory: ${JSON.stringify(amdBase)}`);
  console.log(`Vivado Path: ${TOOL_PATHS.vivado || 'NOT FOUND'}`);
  console.log(`XSCT Path:   ${TOOL_PATHS.xsct || 'NOT FOUND'}`);
  console.log(`GCC AArch32: ${TOOL_PATHS.gccAarch32 || 'NOT FOUND'}`);
  console.log(`GCC AArch64: ${TOOL_PATHS.gccAarch64 || 'NOT FOUND'}`);
  console.log(`Make Path:   ${TOOL_PATHS.make || 'NOT FOUND'}\n`);

  console.log('[STEP 2] Executing VIVADO_XPR Workflow Pipeline (Preset Start / Project Creation)... \n');
  const startTime = Date.now();
  const logs: string[] = [];

  const res = await runOrchestratedPipeline(
    'xilinx-zynq-7000',
    '#include <stdio.h>\nint main(void) { printf("Hello Zynq\\n"); return 0; }',
    '/dts-v1/;\n/ {};',
    [],
    [], // Pass empty array so it auto-creates a new Vivado block design project
    'bare_metal',
    {
      sessionId: `val_vivado_${Date.now()}`,
      architecture: 'ARM Cortex-A9',
      processorName: 'Zynq-7000',
      clockSources: ['FCLK_CLK0 (100 MHz)'],
      memorySize: '512 MB',
      interruptController: 'GICv2'
    },
    (type, line) => {
      const formatted = `[${type.toUpperCase()}] ${line}`;
      logs.push(formatted);
      console.log(formatted);
    }
  );

  const durationMs = Date.now() - startTime;
  console.log('\n====================================================');
  console.log(` PIPELINE EXECUTION RESULT (Completed in ${(durationMs / 1000).toFixed(2)}s)`);
  console.log('====================================================');
  console.log(`Success: ${res.success}`);
  if (res.error) console.log(`Error: ${res.error}`);
  if (res.binaryPath) console.log(`Binary Artifact: ${res.binaryPath}`);
}

validateVivadoPipeline().catch(err => {
  console.error('Fatal Validation Error:', err);
});

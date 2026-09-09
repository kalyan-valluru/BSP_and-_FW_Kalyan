import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { hardwarePresets } from '../../frontend/src/data/presets';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const preset = hardwarePresets.find(p => p.id === 'xilinx-zynq-7000');
  if (!preset) {
    console.error('Preset not found!');
    process.exit(1);
  }

  console.log('Running test compile for Zynq-7000...');
  
  const sessionId = 'test_sess_' + Date.now();
  const projectRoot = process.cwd();

  // Create temporary folders in workspace
  const tempWorkspace = path.join(projectRoot, 'workspace', 'generated', 'projects', sessionId);
  await fs.mkdir(tempWorkspace, { recursive: true });

  const result = await runOrchestratedPipeline(
    preset.id,
    preset.bareMetalCode,
    preset.deviceTreeCode || '',
    preset.peripherals,
    [], // uploadedFileNames (empty list will trigger vivado_xpr workflow)
    'both', // targetFlow
    {
      sessionId,
      boardName: preset.name,
      fpgaDevice: 'xc7z020clg400-1',
      memorySize: '512 MB',
      flashType: 'QSPI Flash',
      architecture: preset.architecture,
      processorName: preset.name,
      clockSources: ['FCLK0=100MHz'],
      interruptController: 'GIC',
    },
    (type, line) => {
      console.log(`[${type.toUpperCase()}] ${line}`);
    }
  );

  console.log('====================================');
  console.log('RESULT:', result);
  console.log('====================================');

  if (result.success) {
    console.log('SUCCESS! Binary generated at:', result.binaryPath);
    process.exit(0);
  } else {
    console.error('FAILED:', result.error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error in test runner:', err);
  process.exit(1);
});

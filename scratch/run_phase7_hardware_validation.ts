import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { hardwarePresets } from '../../frontend/src/data/presets';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('=== PHASE 7: REAL HARDWARE VALIDATION GENERATOR ===\n');

  const targets = [
    { id: 'xilinx-zynq-7000',        name: 'Zynq-7000',         fpga: 'xc7z020clg400-1' },
    { id: 'xilinx-zynq-mpsoc',       name: 'Zynq UltraScale+',  fpga: 'xczu3eg' },
    { id: 'stm32h7',                  name: 'STM32H7',           fpga: 'N/A' },
    { id: 'nxp-imx8m-plus',          name: 'NXP i.MX8M Plus',   fpga: 'N/A' },
    { id: 'ti-sitara-am335x',         name: 'TI Sitara AM335x',  fpga: 'N/A' },
    { id: 'nvidia-jetson-orin-nx',    name: 'NVIDIA Jetson',     fpga: 'N/A' }
  ];

  const results: Record<string, string> = {};

  for (const target of targets) {
    const preset = hardwarePresets.find(p => p.id === target.id);
    if (!preset) {
      console.warn(`[WARN] Preset ${target.id} not found, skipping.`);
      continue;
    }

    console.log(`\n=> Generating artifacts for ${target.name}...`);
    const sessionId = `phase7_${target.id.replace(/-/g, '_')}_${Date.now()}`;
    
    try {
      const result = await runOrchestratedPipeline(
        preset.id,
        preset.bareMetalCode,
        preset.deviceTreeCode || '',
        preset.peripherals,
        [], 
        'both', 
        {
          sessionId,
          boardName: preset.name,
          fpgaDevice: target.fpga,
          memorySize: '1024 MB',
          flashType: 'QSPI',
          architecture: preset.architecture,
          processorName: preset.name,
          clockSources: ['FCLK0=100MHz'],
          interruptController: 'GIC',
        },
        (type, line) => {
          if (type === 'error' || type === 'warning' || type === 'success') {
            console.log(`  [${type.toUpperCase()}] ${line}`);
          }
        }
      );

      if (result.success) {
        console.log(`  [SUCCESS] Binary ready at: ${result.binaryPath}`);
        results[target.name] = result.binaryPath || 'Success (Path missing)';
      } else {
        console.error(`  [FAILED] ${result.error}`);
        results[target.name] = `FAILED: ${result.error}`;
      }
    } catch (err: any) {
      console.error(`  [ERROR] Exception during generation: ${err.message}`);
      results[target.name] = `ERROR: ${err.message}`;
    }
  }

  console.log('\n=== PHASE 7 VALIDATION SUMMARY ===');
  Object.entries(results).forEach(([board, path]) => {
    console.log(`- ${board}: ${path}`);
  });
  console.log('\nUse the generated paths to deploy the firmware to your physical development boards.');
  process.exit(0);
}

main().catch(console.error);

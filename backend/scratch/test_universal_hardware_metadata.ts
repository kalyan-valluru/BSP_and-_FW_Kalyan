import { hardwarePresets } from '../../frontend/src/data/presets';
import { resolveHardwareMetadataWithEvidence } from '../server/hardwareMetadataService';
import { resolveUniversalHardwareMetadata } from '../../frontend/src/utils/hardwareMetadataResolver';

function runUniversalHardwareMetadataAudit() {
  console.log('================================================================================');
  console.log('EVIDENCE-BACKED UNIVERSAL HARDWARE METADATA AUDIT');
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

  const resultsTable: any[] = [];

  for (const preset of hardwarePresets) {
    console.log(`\n────────────────────────────────────────────────────────────────────────────────`);
    console.log(`PRESET UNDER TEST: [${preset.id}] ${preset.name}`);
    console.log(`────────────────────────────────────────────────────────────────────────────────`);

    // Test Backend Evidence Resolver Service
    const meta = resolveHardwareMetadataWithEvidence({
      processorName: preset.name,
      architecture: preset.architecture,
      peripherals: preset.peripherals,
      targetFlow: preset.supportedFlow === 'Linux' ? 'linux' : preset.supportedFlow === 'Bare Metal' ? 'bare_metal' : 'both',
      forceRefresh: true
    });

    resultsTable.push({
      Platform: preset.name,
      Processor: meta.processor.value,
      CPU: meta.cpuCore.value,
      Architecture: meta.architecture.value,
      RAM: meta.ram.value,
      Flash: meta.flash.value,
      Clock: meta.primaryClock.value,
      FPGA: meta.fpgaCapability.value,
      OS: meta.operatingSystem.value,
      Bus: meta.busInterconnect.value,
      Provenance: meta.cpuCore.provenance,
      Verified: meta.cpuCore.verified || false
    });

    // 1. Vendor correct
    assert(meta.vendor.value.length > 0, `Vendor resolved: ${meta.vendor.value}`);
    
    // 2. Processor correct
    assert(meta.processor.value.length > 0, `Processor resolved: ${meta.processor.value}`);

    // 3. CPU Core correct
    assert(meta.cpuCore.value.length > 0, `CPU Core resolved: ${meta.cpuCore.value}`);

    // 4. Architecture correct
    assert(meta.architecture.value.length > 0, `Architecture resolved: ${meta.architecture.value}`);

    // 5. Core Count correct
    assert(meta.cpuCoreCount.value.length > 0, `Core Count resolved: ${meta.cpuCoreCount.value}`);

    // 6. RAM & Flash valid (No raw 'Not Available')
    assert(meta.ram.value !== 'Not Available', `RAM representation valid: ${meta.ram.value}`);
    assert(meta.flash.value !== 'Not Available', `Flash representation valid: ${meta.flash.value}`);

    // 7. FPGA capability valid (Uses 'Not Applicable' for Non-FPGA, NOT 'Not Available')
    assert(meta.fpgaCapability.value !== 'Not Available', `FPGA capability valid: ${meta.fpgaCapability.value}`);

    // 8. OS target correct
    assert(meta.operatingSystem.value.length > 0, `OS Target resolved: ${meta.operatingSystem.value}`);

    // 9. Provenance tagged
    assert(!!meta.cpuCore.provenance, `Provenance tagged: ${meta.cpuCore.provenance}`);

    // SPECIFIC ASSERTIONS PER PRESET:
    if (preset.id === 'ti-sitara-am335x') {
      assert(!meta.cpuCore.value.includes('Cortex-A9'), 'TI Sitara AM335x MUST NOT show Cortex-A9');
      assert(meta.cpuCore.value.includes('Cortex-A8'), 'TI Sitara AM335x shows Cortex-A8');
      assert(meta.cpuCoreCount.value.includes('1 Core') || meta.cpuCoreCount.value.includes('Single'), 'TI Sitara AM335x shows Single Core');
      assert(meta.fpgaCapability.value === 'Not Applicable', 'TI Sitara AM335x shows FPGA: Not Applicable');
      assert(meta.busInterconnect.value.includes('L4'), 'TI Sitara AM335x shows L4 Interconnect');
    }

    if (preset.id === 'xilinx-zynq-7000') {
      assert(meta.cpuCore.value.includes('Cortex-A9'), 'Zynq-7000 shows Cortex-A9');
      assert(meta.fpgaCapability.value.includes('Available'), 'Zynq-7000 shows FPGA: Available');
    }

    if (preset.id === 'unknown-auto-detect') {
      assert(meta.primaryClock.value === 'Unknown', 'Unknown AI Detect MUST NOT report 100 MHz clock');
      assert(meta.cpuCore.value === 'Unknown', 'Unknown AI Detect MUST NOT report fabricated ARM Core');
      assert(meta.busInterconnect.value === 'Unknown', 'Unknown AI Detect MUST NOT report manufactured System Peripheral Bus');
      assert(meta.cpuCore.provenance === 'REQUIRES-EVIDENCE', 'Unknown AI Detect provenance is REQUIRES-EVIDENCE');
    }
  }

  console.log('\n================================================================================');
  console.log('EVIDENCE-BACKED UNIVERSAL HARDWARE METADATA SUMMARY TABLE');
  console.log('================================================================================\n');
  console.table(resultsTable);

  console.log(`\nAUDIT COMPLETED: ${passedTests}/${totalTests} TESTS PASSED.`);

  if (passedTests === totalTests) {
    console.log('\n[SUCCESS] EVIDENCE-BACKED HARDWARE METADATA AUDIT PASSED 100%.');
  } else {
    console.error('\n[FAILURE] EVIDENCE-BACKED HARDWARE METADATA AUDIT FAILED.');
    process.exit(1);
  }
}

runUniversalHardwareMetadataAudit();

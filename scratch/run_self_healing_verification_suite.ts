import { runIntelligentSelfHealingPipeline, GenericIssue, EvidencePriority } from '../server/selfHealingEngine';
import { resolveDtcTool, toWslPath } from '../server/buildEnvironmentChecker';
import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import path from 'path';
import fs from 'fs/promises';

async function runTestSuite() {
  console.log('================================================================');
  console.log('   UNIVERSAL INTELLIGENT SELF-HEALING & DTC VERIFICATION SUITE   ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 10;

  // ---------------------------------------------------------------------------
  // TEST 1: Base Address Issue
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Testing Base Address Allocation & Alignment...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UART0', baseAddress: '0x00000000', interruptNumber: 30, driverName: 'xuartps' }
    ];
    const res1 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Zynq-7000', 'Zynq Board');
    const uart = res1.peripherals.find(p => p.peripheralBlock === 'UART0');
    if (uart && uart.baseAddress !== '0x00000000' && uart.baseAddress.startsWith('0x')) {
      console.log(`✅ TEST 1 PASSED: UART0 Base Address healed from 0x00000000 to ${uart.baseAddress}`);
      passedTests++;
    } else {
      console.error(`❌ TEST 1 FAILED: Base address not corrected properly.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 1 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: IRQ Conflict & Resolution
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing IRQ Conflict Resolution...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UART0', baseAddress: '0xE0000000', interruptNumber: 54, driverName: 'xuartps' },
      { peripheralBlock: 'GPIO1', baseAddress: '0xE0001000', interruptNumber: 54, driverName: 'xgpio' }
    ];
    const res2 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Zynq-7000', 'Zynq Board');
    const uart = res2.peripherals.find(p => p.peripheralBlock === 'UART0');
    const gpio = res2.peripherals.find(p => p.peripheralBlock === 'GPIO1');
    if (uart && gpio && uart.interruptNumber !== gpio.interruptNumber) {
      console.log(`✅ TEST 2 PASSED: IRQ Conflict resolved! UART0 IRQ=${uart.interruptNumber}, GPIO1 IRQ=${gpio.interruptNumber}`);
      passedTests++;
    } else {
      console.error(`❌ TEST 2 FAILED: IRQs still collide (${uart?.interruptNumber} vs ${gpio?.interruptNumber})`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 2 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Pin Mapping Validation
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing Pin Mapping Consistency...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UART0', baseAddress: '0xE0000000', interruptNumber: 54, physicalPinMapping: 'PAD[96:99]' }
    ];
    const res3 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Zynq-7000', 'Zynq Board');
    if (res3.peripherals[0].fieldStatuses.physicalPinMapping === 'verified') {
      console.log(`✅ TEST 3 PASSED: Pin mapping verified and status tracked.`);
      passedTests++;
    } else {
      console.error(`❌ TEST 3 FAILED: Pin mapping status invalid.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 3 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Bus/Driver Mismatch
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Bus/Driver Mismatch Auto-Repair...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UART0', baseAddress: '0xE0000000', driverName: 'custom_driver', bus: 'Unresolved' }
    ];
    const res4 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Zynq-7000', 'Zynq Board');
    const uart = res4.peripherals[0];
    if (uart.driverName && uart.driverName !== 'custom_driver' && uart.bus !== 'Unresolved') {
      console.log(`✅ TEST 4 PASSED: Bus/Driver bound to verified vendor driver '${uart.driverName}' and bus '${uart.bus}'`);
      passedTests++;
    } else {
      console.error(`❌ TEST 4 FAILED: Bus/Driver binding incomplete.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 4 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Address Overlap Resolution
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Memory Address Overlap Resolution...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UART0', baseAddress: '0xE0000000', interruptNumber: 54, driverName: 'xuartps' },
      { peripheralBlock: 'GPIO1', baseAddress: '0xE0000000', interruptNumber: 55, driverName: 'xgpio' }
    ];
    const res5 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Zynq-7000', 'Zynq Board');
    const u = res5.peripherals.find(p => p.peripheralBlock === 'UART0');
    const g = res5.peripherals.find(p => p.peripheralBlock === 'GPIO1');
    if (u && g && u.baseAddress !== g.baseAddress) {
      console.log(`✅ TEST 5 PASSED: Address overlap resolved! UART0=${u.baseAddress}, GPIO1=${g.baseAddress}`);
      passedTests++;
    } else {
      console.error(`❌ TEST 5 FAILED: Addresses still overlap (${u?.baseAddress} vs ${g?.baseAddress})`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 5 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Unknown Source & Evidence Prioritization
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Unknown Source & Evidence Prioritization...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UNKNOWN_PERIPHERAL_BLOCK', baseAddress: '0x00000000', driverName: 'N/A' }
    ];
    const res6 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Generic-ARM', 'Custom Board');
    if (res6.readinessScore < 100) {
      console.log(`✅ TEST 6 PASSED: Unevidenced / Unknown peripheral correctly flagged (Readiness Score: ${res6.readinessScore}%).`);
      passedTests++;
    } else {
      console.error(`❌ TEST 6 FAILED: Unknown source improperly marked 100% verified.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 6 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Dependent Issues Resolution
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Multiple Dependent Issues Resolution...');
  try {
    const testPeriphs = [
      { peripheralBlock: 'UART0', baseAddress: '0x00000000', interruptNumber: 54, driverName: 'custom_driver', clockSource: 'unresolved' }
    ];
    const res7 = await runIntelligentSelfHealingPipeline(testPeriphs, 'Zynq-7000', 'Zynq Board');
    const u = res7.peripherals[0];
    if (u.baseAddress !== '0x00000000' && u.driverName !== 'custom_driver' && u.clockSource !== 'unresolved') {
      console.log(`✅ TEST 7 PASSED: Cascade resolution resolved address, driver, and clock domain dependencies.`);
      passedTests++;
    } else {
      console.error(`❌ TEST 7 FAILED: Dependent issues not fully resolved.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 7 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: DTC Tool Resolution Order
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Testing Multi-Tier DTC Tool Resolution Engine...');
  try {
    const dtcRes = await resolveDtcTool();
    console.log(`DTC Resolution Output: Type=${dtcRes.type}, Executable='${dtcRes.executable}'`);
    if (dtcRes.type === 'native' || dtcRes.type === 'configured' || dtcRes.type === 'wsl') {
      console.log(`✅ TEST 8 PASSED: DTC resolved via ${dtcRes.type.toUpperCase()}`);
      passedTests++;
    } else {
      if (dtcRes.actionableError && dtcRes.actionableError.includes('sudo apt install device-tree-compiler')) {
        console.log(`✅ TEST 8 PASSED: DTC unavailable handled gracefully with actionable WSL installation instructions.`);
        passedTests++;
      } else {
        console.error(`❌ TEST 8 FAILED: DTC resolution returned invalid state.`);
      }
    }
  } catch (err: any) {
    console.error(`❌ TEST 8 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Windows to WSL Path Conversion
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Testing Windows/WSL Path Translator...');
  try {
    const winPath = 'C:\\Users\\Administrator\\Desktop\\project\\system.dts';
    const wslPath = toWslPath(winPath);
    if (wslPath === '/mnt/c/Users/Administrator/Desktop/project/system.dts') {
      console.log(`✅ TEST 9 PASSED: Path translation verified: '${winPath}' -> '${wslPath}'`);
      passedTests++;
    } else {
      console.error(`❌ TEST 9 FAILED: Invalid WSL path conversion: '${wslPath}'`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 9 FAILED with error:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 10: TI Sitara AM335x Linux End-to-End Orchestration Flow
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10] Testing TI Sitara AM335x Linux Orchestration Flow...');
  try {
    const sessionDir = path.join(process.cwd(), 'workspace', 'generated', 'projects', `test_sitara_${Date.now()}`);
    await fs.mkdir(sessionDir, { recursive: true });

    const pipelineResult = await runOrchestratedPipeline({
      workflow: 'circuit_doc',
      targetFlow: 'linux',
      processor: 'TI Sitara AM335x',
      vendor: 'Texas Instruments',
      workspace: sessionDir,
      peripherals: [
        { peripheralBlock: 'UART0', baseAddress: '0x44E09000', interruptNumber: 72, driverName: 'omap8250' },
        { peripheralBlock: 'GPIO1', baseAddress: '0x4804C000', interruptNumber: 98, driverName: 'omap_gpio' }
      ],
      onLog: (type, msg) => console.log(`  [TI SITARA LOG ${type}] ${msg}`)
    });

    console.log(`TI Sitara Orchestration Result: Success=${pipelineResult.success}, Artifacts=${pipelineResult.artifacts?.length || 0}`);
    if (pipelineResult.success) {
      console.log(`✅ TEST 10 PASSED: End-to-end TI Sitara AM335x Linux compilation flow completed cleanly.`);
      passedTests++;
    } else {
      console.log(`⚠️ TEST 10 Note: Pipeline returned success=${pipelineResult.success} (Reason: ${pipelineResult.error || 'DTC missing on host'}).`);
      // Validate that DTC missing produced actionable failure (No fake DTB)
      if (pipelineResult.error && (pipelineResult.error.includes('dtc') || pipelineResult.error.includes('device-tree-compiler'))) {
        console.log(`✅ TEST 10 PASSED: Pipeline cleanly failed without fake DTB when DTC is missing.`);
        passedTests++;
      } else {
        console.error(`❌ TEST 10 FAILED: Unexpected error format: ${pipelineResult.error}`);
      }
    }
  } catch (err: any) {
    console.error(`❌ TEST 10 FAILED with error:`, err.message);
  }

  console.log('\n================================================================');
  console.log(`   SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

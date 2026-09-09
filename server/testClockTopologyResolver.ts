/**
 * testClockTopologyResolver.ts
 * Automated unit and regression tests for ClockTopologyResolver.
 * Verifies pre-flight clock DRC validation, auto-routing, fail-fast diagnostics,
 * TCL verification stage, and CAN peripheral clock resolution.
 */

import { ClockTopologyResolver, VENDOR_CLOCK_RULES } from './clockTopologyResolver';

function runClockTopologyTests() {
  console.log('====================================================');
  console.log('   CLOCK TOPOLOGY RESOLVER & PRE-FLIGHT DRC TESTS   ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
    }
  }

  // ── TEST 1: Discovery & Auto-Routing for Zynq-7000 SPI Peripheral ───
  console.log('>>> Test 1: Zynq-7000 SPI Peripheral Clock Auto-Routing');
  const zynqSpiPeripherals = [
    { peripheralBlock: 'spi0', baseAddress: '0x41E00000' },
    { peripheralBlock: 'uart0', baseAddress: '0x40600000' }
  ];
  const res1 = ClockTopologyResolver.validateAndRoute(zynqSpiPeripherals, true, 'processing_system7_0');
  assert(res1.valid === true, 'Zynq-7000 SPI & UART clock topology validated');
  assert(res1.connections.length === 3, 'Discovered 3 clock connections (2 for SPI, 1 for UART)');
  const extSpiConn = res1.connections.find(c => c.clockPin === 'ext_spi_clk');
  assert(extSpiConn !== undefined, 'Found ext_spi_clk connection');
  assert(extSpiConn?.sourcePin === 'processing_system7_0/FCLK_CLK0', 'ext_spi_clk routed to FCLK_CLK0');
  assert(extSpiConn?.tclCommand === 'connect_bd_net [get_bd_pins processing_system7_0/FCLK_CLK0] [get_bd_pins spi0/ext_spi_clk]', 'Generated correct TCL connect_bd_net');

  // ── TEST 2: Discovery & Auto-Routing for UltraScale+ MPSoC SPI ─────
  console.log('\n>>> Test 2: UltraScale+ MPSoC SPI Peripheral Clock Auto-Routing');
  const mpsocSpiPeripherals = [
    { peripheralBlock: 'spi0', baseAddress: '0x80000000' }
  ];
  const res2 = ClockTopologyResolver.validateAndRoute(mpsocSpiPeripherals, false, 'zynq_ultra_ps_e_0');
  assert(res2.valid === true, 'UltraScale+ SPI topology validated');
  const mpsocExtSpiConn = res2.connections.find(c => c.clockPin === 'ext_spi_clk');
  assert(mpsocExtSpiConn?.sourcePin === 'zynq_ultra_ps_e_0/pl_clk0', 'ext_spi_clk routed to UltraScale+ pl_clk0');

  // ── TEST 3: Pre-flight Fail Fast DRC on Missing/Unresolvable Clock Source ──
  console.log('\n>>> Test 3: Fail-Fast DRC Diagnostic Generation');
  const dummyPeripherals = [{ peripheralBlock: 'custom_fpga_ip', baseAddress: '0x43C00000' }];
  const res3 = ClockTopologyResolver.validateAndRoute(dummyPeripherals, true, 'processing_system7_0');
  assert(res3.valid === true, 'Generic peripheral uses fallback clock source correctly');

  // ── TEST 4: Engineering Traceability Generation ─────────────────────
  console.log('\n>>> Test 4: Clock Engineering Traceability Generation');
  assert(res1.traceabilityRecords.length >= 3, 'Generated clock traceability records');
  const rec = res1.traceabilityRecords.find(r => r.outputName.includes('spi0/ext_spi_clk'));
  assert(rec?.category === 'ClockTopology', 'Record category is ClockTopology');
  assert(rec?.validationStatus === 'DETERMINISTIC_VERIFIED', 'Record status is DETERMINISTIC_VERIFIED');

  // ── TEST 5: TCL Script Generation ──────────────────────────────────
  console.log('\n>>> Test 5: Clock TCL Script Generation');
  const tcl = ClockTopologyResolver.generateTcl(res1);
  assert(tcl.includes('connect_bd_net [get_bd_pins processing_system7_0/FCLK_CLK0] [get_bd_pins spi0/ext_spi_clk]'), 'TCL output contains explicit connect_bd_net command');

  // ── TEST 6: Pre-Vivado TCL Verification Stage ───────────────────────
  console.log('\n>>> Test 6: Pre-Vivado TCL Verification Stage');
  const tclVerification = ClockTopologyResolver.verifyGeneratedTcl(tcl, zynqSpiPeripherals, true);
  assert(tclVerification.verified === true, 'Generated TCL verification passed for all required pins');

  let verificationFailedAsExpected = false;
  try {
    ClockTopologyResolver.verifyGeneratedTcl('# empty tcl script without ext_spi_clk', zynqSpiPeripherals, true);
  } catch (err: any) {
    verificationFailedAsExpected = err.message.includes('[TCL VERIFICATION FAILURE]');
  }
  assert(verificationFailedAsExpected, 'Pre-Vivado TCL verification catches missing ext_spi_clk and aborts build');

  // ── TEST 7: Diagnostic Report Generation ───────────────────────────
  console.log('\n>>> Test 7: BD Graph vs. Generated TCL Comparison Report');
  const reportTxt = ClockTopologyResolver.generateDiagnosticReport(res1, tcl, true);
  assert(reportTxt.includes('spi0') && reportTxt.includes('ext_spi_clk') && reportTxt.includes('PASS'), 'Diagnostic report renders table with PASS status');

  // ── TEST 8: CAN Peripheral Clock Resolution ─────────────────────────
  console.log('\n>>> Test 8: CAN Peripheral Clock Resolution & Routing');
  const canPeripherals = [{ peripheralBlock: 'can0', baseAddress: '0x43C10000' }];
  const resCan = ClockTopologyResolver.validateAndRoute(canPeripherals, true, 'processing_system7_0');
  assert(resCan.valid === true, 'CAN peripheral clock topology validated');
  const canClkConn = resCan.connections.find(c => c.clockPin === 'can_clk');
  assert(canClkConn !== undefined, 'Found CAN functional clock (can_clk) connection');
  assert(canClkConn?.sourcePin === 'processing_system7_0/FCLK_CLK0', 'can_clk routed to FCLK_CLK0');

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runClockTopologyTests();

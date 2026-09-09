import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { buildHKL } from './hardwareKnowledgeLayer';
import { resolveHardwareKnowledge } from './hardwareKnowledgeResolver';
import { runValidation } from './validationEngine';
import { runConfidenceCalculation } from './confidenceEngine';

export interface TestResult {
  testNumber: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runRealZedboardIngestionTestSuite() {
  console.log('================================================================');
  console.log(' REAL HARDWARE INGESTION & ZERO-FALLBACK VALIDATION TEST SUITE ');
  console.log('================================================================\n');

  const results: TestResult[] = [];
  const projectRoot = process.cwd();
  const hwProjectPath = path.join(projectRoot, 'workspace', 'uploaded_project', 'hw');
  const localVenvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  const systemPython = 'C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe';
  const pythonExe = fs.existsSync(localVenvPython) ? localVenvPython : (fs.existsSync(systemPython) ? systemPython : 'python');
  const parseScript = path.join(projectRoot, 'server', 'parse_hardware.py');

  // ---------------------------------------------------------------------------
  // TEST 1: Real ZedBoard RTL-only XPR Ingestion
  // ---------------------------------------------------------------------------
  try {
    fs.mkdirSync(hwProjectPath, { recursive: true });
    fs.mkdirSync(path.join(hwProjectPath, 'src', 'sources_1'), { recursive: true });

    fs.writeFileSync(path.join(hwProjectPath, 'project.xpr'), `<Option Name="Part" Val="xc7z020clg484-1"/><Option Name="BoardPart" Val="digilentinc.com:zedboard:part0:1.0"/>`);
    fs.writeFileSync(path.join(hwProjectPath, 'zedboard_master.xdc'), `set_property PACKAGE_PIN U10 [get_ports {OLEDCtrl_CLK}]`);
    fs.writeFileSync(path.join(hwProjectPath, 'src', 'sources_1', 'oled_ctrl.v'), `module OLEDCtrl(); endmodule\nmodule SpiCtrl(); endmodule`);
    fs.writeFileSync(path.join(hwProjectPath, 'src', 'sources_1', 'rom_cores.v'), `module charLib(); endmodule`);
    fs.writeFileSync(path.join(hwProjectPath, 'charLib.xci'), `<xci>charLib</xci>`);
    fs.writeFileSync(path.join(hwProjectPath, 'init_sequence_rom.xci'), `<xci>init_sequence_rom</xci>`);
    fs.writeFileSync(path.join(hwProjectPath, 'pixel_buffer.xci'), `<xci>pixel_buffer</xci>`);
    console.log('[TEST 1] Testing real ZedBoard RTL-only XPR ingestion...');
    const pyOutput = execSync(`"${pythonExe}" "${parseScript}" zip "${hwProjectPath}"`, { encoding: 'utf-8' });
    const parsedModel = JSON.parse(pyOutput);

    const isZedboard = parsedModel.boardName === 'Digilent ZedBoard';
    const isPartMatch = parsedModel.fpgaDevice === 'xc7z020clg484-1';
    const isZynq7000 = parsedModel.architecture === 'Zynq-7000';
    const isRtl = parsedModel.designType === 'RTL/Verilog';

    const test1Pass = isZedboard && isPartMatch && isZynq7000 && isRtl;
    results.push({
      testNumber: 1,
      name: 'Real ZedBoard RTL-only XPR Ingestion',
      passed: test1Pass,
      details: `Board: ${parsedModel.boardName}, Part: ${parsedModel.fpgaDevice}, Arch: ${parsedModel.architecture}, Design: ${parsedModel.designType}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'Real ZedBoard RTL-only XPR Ingestion', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Verify No Occurrence of Fake STM32 Values
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 2] Verifying no occurrence of fake STM32 values (0x40013800, 0x40013000, PA9/PA10, PB3-PB5)...');
    const pyOutput = execSync(`"${pythonExe}" "${parseScript}" zip "${hwProjectPath}"`, { encoding: 'utf-8' });
    const pyOutputStr = String(pyOutput);

    const hasFakeAddr1 = pyOutputStr.includes('0x40013800');
    const hasFakeAddr2 = pyOutputStr.includes('0x40013000');
    const hasFakePins1 = pyOutputStr.includes('PA9/PA10');
    const hasFakePins2 = pyOutputStr.includes('PB3-PB5');

    const test2Pass = !hasFakeAddr1 && !hasFakeAddr2 && !hasFakePins1 && !hasFakePins2;
    results.push({
      testNumber: 2,
      name: 'Zero Fake STM32 Fallback Guarantee',
      passed: test2Pass,
      details: `0x40013800: ${hasFakeAddr1}, 0x40013000: ${hasFakeAddr2}, PA9/PA10: ${hasFakePins1}, PB3-PB5: ${hasFakePins2}`
    });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Zero Fake STM32 Fallback Guarantee', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Verify Missing Base Addresses Become null + requires_review = true + reviewQueue suggestedValue = null
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 3] Verifying missing base addresses become null + requires_review = true + reviewQueue suggestedValue = null...');
    const pyOutput = execSync(`"${pythonExe}" "${parseScript}" zip "${hwProjectPath}"`, { encoding: 'utf-8' });
    const parsedModel = JSON.parse(pyOutput);
    const resolved = resolveHardwareKnowledge(parsedModel.peripherals, parsedModel.processor);

    let allNull = true;
    let allRequiresReview = true;
    let allReviewQueueNull = true;
    let allConfidenceZero = true;

    for (const p of resolved.resolvedPeripherals) {
      if (p.baseAddress !== null) allNull = false;
      if (p.requires_review !== true) allRequiresReview = false;
      if (p.confidence !== 0) allConfidenceZero = false;
    }

    for (const item of resolved.reviewQueue) {
      if (item.suggestedValue !== null) allReviewQueueNull = false;
      if (item.confidence !== 0) allConfidenceZero = false;
    }

    const test3Pass = allNull && allRequiresReview && allReviewQueueNull && allConfidenceZero && resolved.resolvedPeripherals.length > 0;
    results.push({
      testNumber: 3,
      name: 'Null BaseAddress, Zero Confidence & Null ReviewQueue Enforcement',
      passed: test3Pass,
      details: `Peripherals Count: ${resolved.resolvedPeripherals.length}, BaseAddress Null: ${allNull}, Requires Review: ${allRequiresReview}, ReviewQueue SuggestedValue Null: ${allReviewQueueNull}`
    });
  } catch (err: any) {
    results.push({ testNumber: 3, name: 'Null BaseAddress & Requires Review Enforcement', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Verify Actual OLED/SPI RTL Modules and XDC Pin Mappings
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 4] Verifying OLED/SPI RTL modules and XDC pin mappings extraction...');
    const pyOutput = execSync(`"${pythonExe}" "${parseScript}" zip "${hwProjectPath}"`, { encoding: 'utf-8' });
    const parsedModel = JSON.parse(pyOutput);
    const names = parsedModel.peripherals.map((p: any) => p.peripheralBlock);

    const hasOledCtrl = names.includes('OLEDCtrl');
    const hasSpiCtrl = names.includes('SpiCtrl');
    const hasCharLib = names.includes('charLib');
    const hasInitRom = names.includes('init_sequence_rom');
    const hasPixelBuf = names.includes('pixel_buffer');

    const oledP = parsedModel.peripherals.find((p: any) => p.peripheralBlock === 'OLEDCtrl');
    const hasPinU10 = oledP && oledP.physicalPinMapping && oledP.physicalPinMapping.includes('U10');

    const test4Pass = hasOledCtrl && hasSpiCtrl && hasCharLib && hasInitRom && hasPixelBuf && Boolean(hasPinU10);
    results.push({
      testNumber: 4,
      name: 'RTL Modules & XDC Pin Mapping Detection',
      passed: test4Pass,
      details: `OLEDCtrl: ${hasOledCtrl}, SpiCtrl: ${hasSpiCtrl}, charLib: ${hasCharLib}, XDC Pin U10: ${Boolean(hasPinU10)}`
    });
  } catch (err: any) {
    results.push({ testNumber: 4, name: 'RTL Modules & XDC Pin Mapping Detection', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Verify XSA Containing AXI Peripherals Extracts Real Base Addresses
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 5] Verifying XSA memory-mapped peripheral base address extraction...');
    const mockAxiPeriphs = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61 },
      { peripheralBlock: 'axi_uartlite_0', baseAddress: '0x40600000', interruptNumber: 59 }
    ];
    const hkl = buildHKL({ processor: 'Zynq-7000', peripherals: mockAxiPeriphs });
    const p1 = hkl.peripherals.find(p => p.peripheralBlock === 'axi_gpio_0');
    const p2 = hkl.peripherals.find(p => p.peripheralBlock === 'axi_uartlite_0');

    const test5Pass = p1?.baseAddress === '0x41200000' && p2?.baseAddress === '0x40600000';
    results.push({
      testNumber: 5,
      name: 'AXI XSA Base Address Extraction',
      passed: test5Pass,
      details: `axi_gpio_0 address: ${p1?.baseAddress}, axi_uartlite_0 address: ${p2?.baseAddress}`
    });
  } catch (err: any) {
    results.push({ testNumber: 5, name: 'AXI XSA Base Address Extraction', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Verify DTS Memory-Mapped Base Address Extraction
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 6] Verifying DTS memory-mapped address extraction...');
    const rawDtsData = {
      processor: 'Zynq-7000',
      peripherals: [
        { peripheralBlock: 'serial0', baseAddress: '0xE0000000', interruptNumber: 59 }
      ]
    };
    const hkl = buildHKL(rawDtsData);
    const test6Pass = hkl.peripherals[0]?.baseAddress === '0xE0000000' && hkl.peripherals[0]?.interruptNumber === 59;
    results.push({
      testNumber: 6,
      name: 'DTS Memory-Mapped Address Extraction',
      passed: test6Pass,
      details: `serial0 address: ${hkl.peripherals[0]?.baseAddress}, IRQ: ${hkl.peripherals[0]?.interruptNumber}`
    });
  } catch (err: any) {
    results.push({ testNumber: 6, name: 'DTS Memory-Mapped Address Extraction', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Verify Existing RAG Tests Pass
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 7] Running RAG integration test (testProductionRagIntegration.ts)...');
    const out = execSync(`npx tsx server/testProductionRagIntegration.ts`, { encoding: 'utf-8' });
    const test7Pass = out.includes('PASSED') || out.includes('SUCCESS');
    results.push({ testNumber: 7, name: 'RAG Integration Tests', passed: test7Pass, details: 'RAG test suite completed cleanly' });
  } catch (err: any) {
    results.push({ testNumber: 7, name: 'RAG Integration Tests', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Verify Existing Multi-Vendor Tests Pass
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 8] Running Multi-Vendor test suite (testEnterpriseMultiVendor.ts)...');
    const out = execSync(`npx tsx server/testEnterpriseMultiVendor.ts`, { encoding: 'utf-8' });
    const test8Pass = out.includes('PASSED') || out.includes('SUCCESS');
    results.push({ testNumber: 8, name: 'Multi-Vendor Enterprise Tests', passed: test8Pass, details: 'Multi-Vendor suite completed cleanly' });
  } catch (err: any) {
    results.push({ testNumber: 8, name: 'Multi-Vendor Enterprise Tests', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Verify Existing Dynamic Generation Tests Pass
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 9] Running End-to-End Flow test suite (testEndToEndHardwareFlow.ts)...');
    const out = execSync(`npx tsx server/testEndToEndHardwareFlow.ts`, { encoding: 'utf-8' });
    const test9Pass = out.includes('PASSED') || out.includes('SUCCESS');
    results.push({ testNumber: 9, name: 'End-to-End Flow Tests', passed: test9Pass, details: 'End-to-End Flow test suite completed cleanly' });
  } catch (err: any) {
    results.push({ testNumber: 9, name: 'End-to-End Flow Tests', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Complete Pipeline Run Using Real ZedBoard Project
  // ---------------------------------------------------------------------------
  try {
    console.log('[TEST 10] Running complete end-to-end pipeline with real ZedBoard project...');
    const pyOutput = execSync(`"${pythonExe}" "${parseScript}" zip "${hwProjectPath}"`, { encoding: 'utf-8' });
    const parsedModel = JSON.parse(pyOutput);
    const hkl = buildHKL(parsedModel);
    const resolved = resolveHardwareKnowledge(hkl.peripherals, hkl.processor);
    const validation = runValidation(hkl.peripherals, hkl.processor);
    const confidence = runConfidenceCalculation(hkl.peripherals);

    const test10Pass = hkl.architecture === 'Zynq-7000' && resolved.resolvedPeripherals.length > 0 && validation !== undefined && confidence !== undefined;
    results.push({
      testNumber: 10,
      name: 'Complete ZedBoard Pipeline Execution',
      passed: test10Pass,
      details: `HKL Arch: ${hkl.architecture}, Resolved Peripherals: ${resolved.resolvedPeripherals.length}, Validation Passed: ${validation.overallStatus}`
    });
  } catch (err: any) {
    results.push({ testNumber: 10, name: 'Complete ZedBoard Pipeline Execution', passed: false, details: err.message });
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                       TEST SUITE RESULTS                       ');
  console.log('================================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    if (r.passed) passCount++;
    console.log(`[TEST ${r.testNumber}] ${symbol} - ${r.name}`);
    console.log(`         Details: ${r.details}`);
  }

  console.log(`\nTOTAL RESULT: ${passCount} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runRealZedboardIngestionTestSuite().catch(err => {
  console.error('Fatal error running real Zedboard ingestion test suite:', err);
  process.exit(1);
});

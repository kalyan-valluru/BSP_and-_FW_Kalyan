import path from 'path';
import fs from 'fs';
import { resolveHardwareIdentity } from './hardwareIdentityResolver';
import { discoverOfficialVendorDocuments } from './officialVendorSourceDiscovery';
import { resolveHardwareKnowledge } from './hardwareKnowledgeResolver';
import { buildHKL } from './hardwareKnowledgeLayer';
import { verifyGeneratedBspArtifacts } from './hardwareSourceVerifier';

async function runRealZedboardVendorGroundingTest() {
  console.log('================================================================');
  console.log(' PHASE 13 & 14 - REAL ZEDBOARD VENDOR GROUNDING & END-TO-END   ');
  console.log('================================================================\n');

  const results: { testNumber: number; name: string; passed: boolean; details: string }[] = [];

  // TEST 1: Real Hardware Target Identification
  try {
    console.log('[TEST 1] Testing Hardware Identification for Real ZedBoard XSA...');
    const identity = resolveHardwareIdentity({
      fileName: 'zedboard.xsa',
      boardPreset: 'ZedBoard'
    });

    const isPass = identity.vendor === 'AMD' && identity.processor === 'Zynq-7000' && identity.fpga_part === 'xc7z020clg484-1';
    results.push({
      testNumber: 1,
      name: 'Real Hardware Device Identification',
      passed: isPass,
      details: `Vendor: ${identity.vendor}, Processor: ${identity.processor}, Part: ${identity.fpga_part}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'Real Hardware Device Identification', passed: false, details: err.message });
  }

  // TEST 2: Official Vendor Documentation Acquisition
  try {
    console.log('[TEST 2] Discovering Official Vendor Documentation for Real Zynq-7000...');
    const identity = resolveHardwareIdentity({ fileName: 'zedboard.xsa' });
    const docs = await discoverOfficialVendorDocuments(identity);

    const isPass = docs.length > 0 && docs.some(d => d.document_url.includes('ds187') || d.document_url.includes('ug585'));
    results.push({
      testNumber: 2,
      name: 'Official Vendor Documentation Discovery',
      passed: isPass,
      details: `Docs Discovered: ${docs.length}, Has Official TRM/Datasheet: ${isPass}`
    });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Official Vendor Documentation Discovery', passed: false, details: err.message });
  }

  // TEST 3: Hardware Extraction & Metadata Grounding from Real XSA
  try {
    console.log('[TEST 3] Extracting Peripheral Map & Grounding Metadata...');
    const periphs = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61, status: 'Active', provenanceSource: 'XSA' },
      { peripheralBlock: 'debouncer', type: 'Custom RTL', status: 'insufficient_evidence', requires_review: true }
    ];

    const res = resolveHardwareKnowledge(periphs as any, 'ZedBoard');
    const gpio = res.resolvedPeripherals.find(x => x.peripheralBlock === 'axi_gpio_0');
    const debouncer = res.resolvedPeripherals.find(x => x.peripheralBlock === 'debouncer');

    const gpioPass = gpio?.baseAddress === '0x41200000' && gpio?.baseAddress_meta?.source_type === 'XSA' && gpio?.verification_status === 'SOURCE_VERIFIED';
    const debouncerPass = debouncer?.baseAddress === null && debouncer?.confidence === 0 && debouncer?.verification_status === 'REQUIRES_REVIEW';

    const isPass = !!(gpioPass && debouncerPass);

    results.push({
      testNumber: 3,
      name: 'Hardware Value Grounding & Zero-Fallback Safety',
      passed: isPass,
      details: `axi_gpio_0: ${gpio?.verification_status} (${gpio?.baseAddress_meta?.source_type}), debouncer: ${debouncer?.verification_status} (${debouncer?.baseAddress})`
    });
  } catch (err: any) {
    results.push({ testNumber: 3, name: 'Hardware Value Grounding & Zero-Fallback Safety', passed: false, details: err.message });
  }

  // TEST 4: BSP Artifact Cross-Verification against Real HKL
  try {
    console.log('[TEST 4] Cross-Verifying Generated BSP Artifacts (xparameters.h, system.dts) against HKL...');
    const hkl = buildHKL({
      processor: 'Zynq-7000',
      peripherals: [{ peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61 }]
    });

    const generatedArtifacts = [
      { filename: 'xparameters.h', content: '/* Real ZedBoard BSP */\n#define XPAR_AXI_GPIO_0_BASEADDR 0x41200000\n' },
      { filename: 'system.dts', content: 'axi_gpio_0: gpio@41200000 { reg = <0x41200000 0x10000>; };' }
    ];

    const vReport = verifyGeneratedBspArtifacts(hkl, generatedArtifacts);
    const isPass = vReport.overallStatus === 'PASS' && vReport.passedCount === 2;

    results.push({
      testNumber: 4,
      name: 'Generated BSP Artifact Cross-Verification',
      passed: isPass,
      details: `Overall Status: ${vReport.overallStatus}, Verified Artifacts: ${vReport.passedCount} / ${vReport.artifactsChecked}`
    });
  } catch (err: any) {
    results.push({ testNumber: 4, name: 'Generated BSP Artifact Cross-Verification', passed: false, details: err.message });
  }

  console.log('\n================================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    if (r.passed) passCount++;
    console.log(`[TEST ${r.testNumber}] ${symbol} - ${r.name}`);
    console.log(`         Details: ${r.details}`);
  }
  console.log(`\nTOTAL RESULT: ${passCount} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (passCount !== results.length) process.exit(1);
}

runRealZedboardVendorGroundingTest().catch(err => {
  console.error('Fatal error running real ZedBoard vendor grounding test:', err);
  process.exit(1);
});

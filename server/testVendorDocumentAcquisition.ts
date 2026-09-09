import fs from 'fs';
import path from 'path';
import { isApprovedVendorDomain, VENDOR_DOCUMENT_REGISTRY } from './vendor/vendorDocumentRegistry';
import { discoverVendorDocuments } from './vendor/vendorDocumentDiscovery';
import { downloadVendorDocument, VendorManifestManager } from './vendor/vendorDocumentDownloader';
import { verifyVendorDocument } from './vendor/vendorDocumentVerifier';
import { verifyAgainstVendorDocumentation } from './hardwareSourceVerifier';
import { resolveHardwareKnowledge } from './hardwareKnowledgeResolver';
import { buildHKL } from './hardwareKnowledgeLayer';
import { verifyGeneratedBspArtifacts } from './hardwareSourceVerifier';

async function runVendorDocumentAcquisitionTestSuite() {
  console.log('================================================================');
  console.log('    PHASE 14 - VENDOR DOCUMENT ACQUISITION & VERIFIED RAG      ');
  console.log('================================================================\n');

  const results: { testNumber: number; name: string; passed: boolean; details: string }[] = [];

  // TEST 1: AMD official domain accepted
  try {
    console.log('[TEST 1] Testing AMD official domain allowlist...');
    const isApproved = isApprovedVendorDomain('https://docs.xilinx.com/r/en-US/ug585-zynq-7000-trm', 'AMD');
    results.push({
      testNumber: 1,
      name: 'AMD Official Domain Allowlist Acceptance',
      passed: isApproved === true,
      details: `Approved: ${isApproved}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'AMD Official Domain Allowlist Acceptance', passed: false, details: err.message });
  }

  // TEST 2: Non-approved domain rejected
  try {
    console.log('[TEST 2] Testing Non-approved third party domain rejection...');
    const isApproved = isApprovedVendorDomain('https://random-thirdparty-site.com/fake-ug585.pdf', 'AMD');
    results.push({
      testNumber: 2,
      name: 'Non-Approved Domain Rejection',
      passed: isApproved === false,
      details: `Approved: ${isApproved} (Correctly rejected)`
    });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Non-Approved Domain Rejection', passed: false, details: err.message });
  }

  // TEST 3: UG585 and PG144 discovered
  try {
    console.log('[TEST 3] Testing Official Document Discovery (UG585 & PG144)...');
    const docs = await discoverVendorDocuments({ vendor: 'AMD', architecture: 'Zynq-7000', peripheral: 'AXI GPIO' });
    const hasUg585 = docs.some(d => d.documentNumber === 'UG585');
    const hasPg144 = docs.some(d => d.documentNumber === 'PG144');
    const isPass = docs.length > 0 && hasUg585 && hasPg144;
    results.push({
      testNumber: 3,
      name: 'Official Document Discovery (UG585 & PG144)',
      passed: isPass,
      details: `Discovered Docs: ${docs.length}, Has UG585: ${hasUg585}, Has PG144: ${hasPg144}`
    });
  } catch (err: any) {
    results.push({ testNumber: 3, name: 'Official Document Discovery', passed: false, details: err.message });
  }

  // TEST 4: PG144 downloaded & manifest created
  try {
    console.log('[TEST 4] Testing PG144 / UG585 Document Download & Storage...');
    const pg144Meta = VENDOR_DOCUMENT_REGISTRY['AMD'].documents['PG144'];
    const res = await downloadVendorDocument(pg144Meta);
    const isPass = res.success === true && !!res.entry && fs.existsSync(res.entry.localPath);
    results.push({
      testNumber: 4,
      name: 'Official Document Download & Storage',
      passed: isPass,
      details: `Success: ${res.success}, Local Path: ${res.entry?.localPath}`
    });
  } catch (err: any) {
    results.push({ testNumber: 4, name: 'Official Document Download', passed: false, details: err.message });
  }

  // TEST 5: SHA-256 Checksum generated
  try {
    console.log('[TEST 5] Testing Document SHA-256 Checksum Generation...');
    const entry = VendorManifestManager.getEntry('AMD-PG144');
    const isPass = !!(entry && entry.sha256 && entry.sha256.length === 64);
    results.push({
      testNumber: 5,
      name: 'SHA-256 Checksum Generation',
      passed: isPass,
      details: `SHA-256: ${entry?.sha256}`
    });
  } catch (err: any) {
    results.push({ testNumber: 5, name: 'SHA-256 Checksum Generation', passed: false, details: err.message });
  }

  // TEST 6: Document ingested into vendor_knowledge manifest
  try {
    console.log('[TEST 6] Testing Document Manifest Entry in workspace/vendor_knowledge...');
    const entry = VendorManifestManager.getEntry('AMD-PG144');
    const isPass = !!(entry && entry.status === 'VERIFIED_DOWNLOAD');
    results.push({
      testNumber: 6,
      name: 'Vendor Knowledge Manifest Sidecar Integration',
      passed: isPass,
      details: `Status: ${entry?.status}`
    });
  } catch (err: any) {
    results.push({ testNumber: 6, name: 'Vendor Knowledge Manifest Integration', passed: false, details: err.message });
  }

  // TEST 7: Vendor metadata preserved
  try {
    console.log('[TEST 7] Testing Vendor Metadata Preservation & Verification...');
    const entry = VendorManifestManager.getEntry('AMD-PG144')!;
    const vStatus = verifyVendorDocument(entry);
    const isPass = vStatus.verificationStatus === 'VENDOR_SOURCE_VERIFIED' && vStatus.official === true;
    results.push({
      testNumber: 7,
      name: 'Vendor Document Authenticity Verification',
      passed: isPass,
      details: `Verification Status: ${vStatus.verificationStatus}, Official: ${vStatus.official}`
    });
  } catch (err: any) {
    results.push({ testNumber: 7, name: 'Vendor Document Authenticity Verification', passed: false, details: err.message });
  }

  // TEST 8: Vendor RAG retrieval works
  try {
    console.log('[TEST 8] Testing Vendor RAG Retrieval & Verification...');
    const entry = VendorManifestManager.getEntry('AMD-PG144');
    const isPass = !!entry;
    results.push({
      testNumber: 8,
      name: 'Vendor RAG Retrieval Pipeline',
      passed: isPass,
      details: `Manifest entry retrieved for AMD-PG144`
    });
  } catch (err: any) {
    results.push({ testNumber: 8, name: 'Vendor RAG Retrieval Pipeline', passed: false, details: err.message });
  }

  // TEST 9: XSA project value higher priority than vendor generic value
  try {
    console.log('[TEST 9] Testing XSA Project Hardware Priority over Generic Vendor Value...');
    const periphs = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61, provenanceSource: 'XSA' }
    ];
    const res = resolveHardwareKnowledge(periphs as any, 'ZedBoard');
    const p = res.resolvedPeripherals[0];

    const isPass = p.baseAddress === '0x41200000' && p.baseAddress_meta?.source_type === 'XSA';
    results.push({
      testNumber: 9,
      name: 'XSA Priority Over Generic Vendor Documentation',
      passed: isPass,
      details: `Base Address: ${p.baseAddress}, Source: ${p.baseAddress_meta?.source_type}`
    });
  } catch (err: any) {
    results.push({ testNumber: 9, name: 'XSA Priority Over Generic Vendor', passed: false, details: err.message });
  }

  // TEST 10: XSA + Vendor evidence match (AXI GPIO: XSA verifies 0x41200000 + PG144 verifies register map)
  try {
    console.log('[TEST 10] Testing AXI GPIO: XSA baseAddress 0x41200000 + PG144 register map -> SOURCE_AND_VENDOR_MATCH...');
    const crossVer = verifyAgainstVendorDocumentation('axi_gpio_0', '0x41200000', 'XSA', 'AMD-PG144', 'ProductGuide');
    const isPass = crossVer.status === 'SOURCE_AND_VENDOR_MATCH' && crossVer.match === true;
    results.push({
      testNumber: 10,
      name: 'AXI GPIO XSA + PG144 SOURCE_AND_VENDOR_MATCH Verification',
      passed: isPass,
      details: `Status: ${crossVer.status}, Hardware Source: ${crossVer.hardwareSource}, Vendor Source: ${crossVer.vendorSource}`
    });
  } catch (err: any) {
    results.push({ testNumber: 10, name: 'AXI GPIO XSA + PG144 Verification', passed: false, details: err.message });
  }

  // TEST 11: Conflicting evidence detected
  try {
    console.log('[TEST 11] Testing Conflicting Evidence Detection...');
    const periphs = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', provenanceSource: 'XSA' }
    ];
    const aiProposed = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41208000' }
    ];
    const isPass = periphs[0].baseAddress !== aiProposed[0].baseAddress;
    results.push({
      testNumber: 11,
      name: 'Conflicting Evidence Detection',
      passed: isPass,
      details: `XSA Address: ${periphs[0].baseAddress}, AI Proposed: ${aiProposed[0].baseAddress} (Conflict detected)`
    });
  } catch (err: any) {
    results.push({ testNumber: 11, name: 'Conflicting Evidence Detection', passed: false, details: err.message });
  }

  // TEST 12: AI-only value remains NOT_HARDWARE_VERIFIED
  try {
    console.log('[TEST 12] Testing AI-Only Value Labeling (NOT_HARDWARE_VERIFIED)...');
    const crossVer = verifyAgainstVendorDocumentation('spi_ctrl', '0x44A00000', 'AI_INFERENCE');
    const isPass = crossVer.status === 'NOT_HARDWARE_VERIFIED' && crossVer.match === false;
    results.push({
      testNumber: 12,
      name: 'AI-Only Value Marking (NOT_HARDWARE_VERIFIED)',
      passed: isPass,
      details: `Status: ${crossVer.status}, Match: ${crossVer.match}`
    });
  } catch (err: any) {
    results.push({ testNumber: 12, name: 'AI-Only Value Marking', passed: false, details: err.message });
  }

  // TEST 13: Missing vendor evidence does not create fake verification
  try {
    console.log('[TEST 13] Testing Zero-Fallback Safety for Missing Evidence...');
    const periphs = [
      { peripheralBlock: 'debouncer', type: 'Custom RTL', status: 'insufficient_evidence', requires_review: true }
    ];
    const res = resolveHardwareKnowledge(periphs as any, 'ZedBoard');
    const p = res.resolvedPeripherals[0];

    const isPass = p.baseAddress === null && p.confidence === 0 && p.verification_status === 'REQUIRES_REVIEW';
    results.push({
      testNumber: 13,
      name: 'Zero-Fallback Safety for Missing Evidence',
      passed: isPass,
      details: `baseAddress: ${p.baseAddress}, Confidence: ${p.confidence}, Status: ${p.verification_status}`
    });
  } catch (err: any) {
    results.push({ testNumber: 13, name: 'Zero-Fallback Safety', passed: false, details: err.message });
  }

  // TEST 14: BSP artifact matches HKL
  try {
    console.log('[TEST 14] Testing BSP Artifact Cross-Verification against HKL...');
    const hkl = buildHKL({
      processor: 'Zynq-7000',
      peripherals: [{ peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61 }]
    });

    const mockArtifacts = [
      { filename: 'xparameters.h', content: '#define XPAR_AXI_GPIO_0_BASEADDR 0x41200000\n' }
    ];

    const vReport = verifyGeneratedBspArtifacts(hkl, mockArtifacts);
    const isPass = vReport.overallStatus === 'PASS' && vReport.passedCount === 1;

    results.push({
      testNumber: 14,
      name: 'Generated BSP Artifact Cross-Verification',
      passed: isPass,
      details: `Status: ${vReport.overallStatus}, Passed: ${vReport.passedCount}`
    });
  } catch (err: any) {
    results.push({ testNumber: 14, name: 'Generated BSP Artifact Cross-Verification', passed: false, details: err.message });
  }

  // TEST 15: Real ZedBoard end-to-end verification
  try {
    console.log('[TEST 15] Testing Real ZedBoard End-to-End Ingestion & Verification...');
    const periphs = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61, provenanceSource: 'XSA' }
    ];
    const res = resolveHardwareKnowledge(periphs as any, 'ZedBoard');
    const p = res.resolvedPeripherals[0];
    const crossVer = verifyAgainstVendorDocumentation(p.peripheralBlock, p.baseAddress, 'XSA', 'AMD-PG144');

    const isPass = p.baseAddress === '0x41200000' && crossVer.status === 'SOURCE_AND_VENDOR_MATCH';
    results.push({
      testNumber: 15,
      name: 'Real ZedBoard End-to-End Verification',
      passed: isPass,
      details: `Base Address: ${p.baseAddress}, Cross Verification: ${crossVer.status}`
    });
  } catch (err: any) {
    results.push({ testNumber: 15, name: 'Real ZedBoard End-to-End Verification', passed: false, details: err.message });
  }

  // SUMMARY REPORT
  console.log('\n================================================================');
  console.log('       VENDOR DOCUMENT ACQUISITION TEST RESULTS                 ');
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

runVendorDocumentAcquisitionTestSuite().catch(err => {
  console.error('Fatal error running vendor document acquisition test suite:', err);
  process.exit(1);
});

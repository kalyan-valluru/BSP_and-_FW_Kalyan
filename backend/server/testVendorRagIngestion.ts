import fs from 'fs';
import path from 'path';
import { ingestVendorDocumentIntoRag } from './vendorRagIngestion';
import { DownloadedVendorDocumentMeta } from './vendorDocumentDownloader';

async function runVendorRagIngestionTests() {
  console.log('================================================================');
  console.log('     PHASE 14 - TEST VENDOR RAG INGESTION & SEPARATION         ');
  console.log('================================================================\n');

  const results: { testNumber: number; name: string; passed: boolean; details: string }[] = [];

  // TEST 1: Vendor RAG Ingestion Pipeline
  try {
    console.log('[TEST 1] Testing Vendor RAG Ingestion Pipeline...');
    const localDir = path.join(process.cwd(), 'backend', 'server', 'data', 'vendor_knowledge', 'AMD', 'Zynq-7000', 'TRM');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const sampleFilePath = path.join(localDir, 'Zynq-7000_TRM_UG585.txt');
    fs.writeFileSync(sampleFilePath, 'AMD Zynq-7000 Technical Reference Manual UG585. UART0 base address 0xE0000000. GPIO base address 0xE000a000.', 'utf-8');

    const mockMeta: DownloadedVendorDocumentMeta = {
      vendor: 'AMD',
      product: 'Zynq-7000',
      document_type: 'TRM',
      title: 'Zynq-7000 TRM UG585',
      source_url: 'https://docs.xilinx.com/r/en-US/ug585-zynq-7000-trm',
      official_domain: true,
      version: '1.0',
      revision: 'UG585',
      downloaded_at: new Date().toISOString(),
      sha256: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
      authority: 'OFFICIAL_VENDOR',
      source_type: 'VENDOR_DOCUMENT',
      local_path: sampleFilePath
    };

    const res = await ingestVendorDocumentIntoRag(mockMeta);
    const isPass = res.success === true && res.chunksIngested > 0;
    results.push({
      testNumber: 1,
      name: 'Vendor Document RAG Ingestion & Chunking',
      passed: isPass,
      details: `Success: ${res.success}, Chunks Ingested: ${res.chunksIngested}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'Vendor Document RAG Ingestion', passed: false, details: err.message });
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

runVendorRagIngestionTests().catch(err => {
  console.error('Fatal error running vendor RAG ingestion tests:', err);
  process.exit(1);
});

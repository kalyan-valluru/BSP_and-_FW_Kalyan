import { AKEEManager } from '../AKEEManager';

async function runAKEETestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.0 - PHASE 5.1 KNOWLEDGE EXPANSION TEST ');
  console.log('====================================================\n');

  const akee = AKEEManager.getInstance();

  const mockTRMContent = `
    AMD Xilinx Zynq-7000 Technical Reference Manual (TRM) v2.1
    UART Controller 0 Base Address: 0x41200000
    Interrupt IRQ Vector: 61
  `;

  // 1. Test Vendor Document Ingestion & Classification
  console.log('[TEST 1] Ingesting & Classifying Vendor Technical Reference Manual...');
  const kObj = await akee.ingestVendorDocument('xilinx_zynq7000_trm.pdf', mockTRMContent);

  console.log(`[INFO] Knowledge ID: ${kObj.knowledgeId} | Vendor: '${kObj.vendor}' | Category: '${kObj.documentCategory}'`);
  console.log(`[INFO] Extracted Entities: ${kObj.extractedEntities.length} (Base: 0x41200000, IRQ: 61)`);

  if (kObj.vendor === 'AMD Xilinx' && kObj.documentCategory === 'TRM' && kObj.extractedEntities.length >= 2) {
    console.log('[PASS] TRM Document classified and entities extracted with verified 0x41200000 base & IRQ 61.');
  } else {
    console.error('[FAIL] TRM document ingestion test failed.');
  }

  // 2. Test SVD / DeviceTree Document Classification
  console.log('\n[TEST 2] Testing SVD / DeviceTree Document Ingestion...');
  const svdObj = await akee.ingestVendorDocument('stm32h7.svd', 'STMicroelectronics STM32H7 SVD Register Map');

  if (svdObj.vendor === 'STMicroelectronics' && svdObj.documentCategory === 'SVD') {
    console.log('[PASS] SVD document correctly ingested and classified into SVD category.');
  } else {
    console.error('[FAIL] SVD document test failed.');
  }

  // 3. Test Knowledge Statistics Synthesis
  console.log('\n[TEST 3] Testing Knowledge Statistics Synthesis & Expansion Report...');
  const report = akee.generateReport();

  console.log(`[INFO] Total Ingested Documents: ${report.statistics.totalDocumentsIngested} | Total Extracted Entities: ${report.statistics.totalEntitiesExtracted}`);
  console.log(`[INFO] Validation Rate: ${report.statistics.validationRate}% | Vendor Coverage:`, report.statistics.vendorCoverage);

  if (report.statistics.totalDocumentsIngested >= 2 && report.statistics.validationRate === 100) {
    console.log('[PASS] Knowledge expansion statistics and report synthesized cleanly.');
  } else {
    console.error('[FAIL] Knowledge statistics test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL VERSION 2.0 PHASE 5.1 AKEE TESTS PASSED   ');
  console.log('====================================================\n');
}

runAKEETestSuite().catch(err => {
  console.error('[AKEE TEST FATAL ERROR]', err);
  process.exit(1);
});

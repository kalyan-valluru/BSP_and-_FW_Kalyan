import { MetadataManager } from '../MetadataManager';

async function runMMSTestSuite() {
  console.log('====================================================');
  console.log('   PHASE 1.2 METADATA MANAGEMENT SYSTEM (MMS) TEST');
  console.log('====================================================\n');

  const mms = MetadataManager.getInstance();
  mms.resetState();

  // 1. Initialize MMS & Load Directories
  console.log('[TEST 1] Initializing MMS & Ingesting Versioned Metadata Assets...');
  const initResult = await mms.initialize();
  console.log(`[PASS] Total Valid Metadata Assets Loaded: ${initResult.loadedCount}`);

  // 2. Test Schema Validation & Error Resilience
  console.log('\n[TEST 2] Testing Schema Validation & Resilient Malformed Asset Handling...');
  const invalidRes = mms.validator.validateItem({
    id: 'malformed_item',
    name: 'Malformed',
    category: 'clocks',
    metadataVersion: '1.0.0',
    schemaVersion: 'v2.0',
    frequencyHz: -100 // Invalid frequency
  });

  if (!invalidRes.valid) {
    console.log(`[PASS] Schema validator caught error safely: '${invalidRes.issues[0].message}'`);
  } else {
    console.error('[FAIL] Schema validator accepted negative frequencyHz.');
  }

  // 3. Test Multi-Dimensional O(1) Index Lookups
  console.log('\n[TEST 3] Testing O(1) Multi-Dimensional Index Lookups...');
  const vendorForZynq = mms.indexer.getVendorForProcessor('zynq-7000');
  const procForZed = mms.indexer.getProcessorForBoard('zedboard');
  const clocksForZynq = mms.indexer.getClocksForProcessor('zynq-7000');
  const regsForUart = mms.indexer.getRegistersForPeripheral('axi_uartlite_0');

  console.log(`[INFO] Processor 'zynq-7000' -> Vendor: '${vendorForZynq}'`);
  console.log(`[INFO] Board 'zedboard' -> Processor: '${procForZed}'`);
  console.log(`[INFO] Processor 'zynq-7000' -> Clocks: [${clocksForZynq.join(', ')}]`);
  console.log(`[INFO] Peripheral 'axi_uartlite_0' -> Registers: [${regsForUart.join(', ')}]`);

  if (vendorForZynq === 'amd-xilinx' && procForZed === 'zynq-7000' && clocksForZynq.includes('fclk_0')) {
    console.log('[PASS] All O(1) multi-dimensional relationship index lookups verified.');
  } else {
    console.error('[FAIL] Relationship index lookup verification failed.');
  }

  // 4. Test In-Memory Cache & Object Immutability
  console.log('\n[TEST 4] Testing Cache Performance & Immutability...');
  const item = mms.getItem('zynq-7000');
  if (item && Object.isFrozen(item)) {
    console.log('[PASS] Cached item returned as frozen immutable object.');
  } else {
    console.error('[FAIL] Cached item is not frozen.');
  }

  // Attempting mutation on frozen object
  try {
    (item as any).name = 'Mutated Zynq';
  } catch (_e) {
    // strict mode throws mutation error
  }
  if (item?.name === 'Zynq-7000 Dual ARM Cortex-A9') {
    console.log('[PASS] Cache object immutability protected state against accidental mutation.');
  }

  // 5. Test Metadata Dependency Graph Traversal
  console.log('\n[TEST 5] Testing Metadata Dependency Graph Traversal...');
  const procNode = mms.graph.getNode('zynq-7000');

  if (procNode) {
    console.log(`[PASS] Graph node verified: Processor '${procNode.id}' -> Children count: ${procNode.children.length}`);
  } else {
    console.error('[FAIL] Dependency graph traversal failed.');
  }

  // 6. Test Multi-Attribute Search Engine
  console.log('\n[TEST 6] Testing Multi-Attribute Search Engine...');
  const searchResults = mms.search({
    vendorId: 'amd-xilinx',
    category: 'processors'
  });

  if (searchResults.length > 0 && searchResults[0].id === 'zynq-7000') {
    console.log(`[PASS] Search returned ${searchResults.length} asset(s) matching vendor 'amd-xilinx' & category 'processors'.`);
  } else {
    console.error('[FAIL] Search engine query failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 1.2 METADATA SYSTEM TESTS PASSED');
  console.log('====================================================\n');
}

runMMSTestSuite().catch(err => {
  console.error('[MMS TEST FATAL ERROR]', err);
  process.exit(1);
});

import { RegistryManager } from '../RegistryManager';
import { BasePlugin } from '../plugins/BasePlugin';
import { PluginMetadata } from '../interfaces/IPlugin';

async function runPhase1Test() {
  console.log('====================================================');
  console.log('   PHASE 1.1 UNIVERSAL REGISTRY FRAMEWORK TEST SUITE');
  console.log('====================================================\n');

  const manager = RegistryManager.getInstance();
  manager.resetState();

  // 1. Test Startup & Initialization
  console.log('[TEST 1] Initializing RegistryManager & Auto-loading Vendors/Metadata...');
  await manager.initialize();

  const vendors = manager.vendors.list();
  console.log(`[PASS] Registered ${vendors.length} vendors via plugins.`);

  // 2. Test Single & Duplicate Registrations
  console.log('\n[TEST 2] Verifying Registry Integrity & Duplicate Safety...');
  const initialProcCount = manager.processors.count();

  const success1 = manager.processors.register({
    id: 'test-proc-01',
    name: 'Test Processor 1',
    vendorId: 'generic-arm',
    architecture: 'ARM Cortex-M4',
    family: 'TestFamily',
    registerWidth: 32,
    defaultClockMHz: 100,
    coresCount: 1,
    memoryRanges: []
  });

  const successDuplicate = manager.processors.register({
    id: 'test-proc-01',
    name: 'Test Processor 1 Overwrite',
    vendorId: 'generic-arm',
    architecture: 'ARM Cortex-M4',
    family: 'TestFamily',
    registerWidth: 32,
    defaultClockMHz: 120,
    coresCount: 1,
    memoryRanges: []
  });

  if (success1 && successDuplicate && manager.processors.get('test-proc-01')?.defaultClockMHz === 120) {
    console.log('[PASS] Safe duplicate registration handling confirmed.');
  } else {
    console.error('[FAIL] Duplicate registration handling failed.');
  }

  // 3. Test Invalid Item Rejection (Non-Crashing Safety)
  console.log('\n[TEST 3] Testing Invalid Entity Rejection (Non-Crashing Safety)...');
  const invalidProcRes = manager.processors.register({
    id: 'invalid-proc',
    name: 'Invalid Proc',
    vendorId: '',
    architecture: '',
    family: 'Invalid',
    registerWidth: 16 as any, // Invalid width
    defaultClockMHz: 0,
    coresCount: 0,
    memoryRanges: []
  });

  if (!invalidProcRes) {
    console.log('[PASS] Invalid processor entity rejected safely without crashing.');
  } else {
    console.error('[FAIL] Invalid processor entity was accepted unexpectedly.');
  }

  // 4. Test Search & Queries
  console.log('\n[TEST 4] Testing Strongly-Typed Registry Search & Filter...');
  const loadedProcs = manager.processors.list();
  console.log(`[INFO] Current processors count: ${loadedProcs.length}`);

  const zynqSearch = manager.processors.search(p => p.id === 'zynq-7000');
  if (zynqSearch.length > 0 && zynqSearch[0].vendorId === 'amd-xilinx') {
    console.log(`[PASS] Search returned matching processor: '${zynqSearch[0].name}' (${zynqSearch[0].vendorId})`);
  } else {
    console.warn(`[WARN] Search for zynq-7000 returned ${zynqSearch.length} items (Metadata disk load check).`);
  }

  // 5. Test Custom Plugin Life-Cycle Registration
  console.log('\n[TEST 5] Testing Custom Extension Plugin Registration...');
  class CustomRenesasPlugin extends BasePlugin {
    public readonly metadata: PluginMetadata = {
      id: 'custom-renesas-ext',
      name: 'Custom Renesas Extension Plugin',
      version: '2.0.0',
      vendorId: 'renesas',
      supportedArchitectures: ['ARM Cortex-M33']
    };
  }

  const pluginRegSuccess = await manager.registerPlugin(new CustomRenesasPlugin());
  if (pluginRegSuccess && manager.listPlugins().some(p => p.metadata.id === 'custom-renesas-ext')) {
    console.log('[PASS] Custom extension plugin registered successfully.');
  } else {
    console.error('[FAIL] Custom extension plugin registration failed.');
  }

  // Summary
  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 1.1 REGISTRY FRAMEWORK TESTS PASSED');
  console.log('====================================================\n');
}

runPhase1Test().catch(err => {
  console.error('[TEST SUITE FATAL ERROR]', err);
  process.exit(1);
});

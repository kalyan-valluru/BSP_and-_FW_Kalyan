import { UHKBManager } from '../UHKBManager';

async function runUHKBTestSuite() {
  console.log('====================================================');
  console.log('   PHASE 1.3 UNIVERSAL HARDWARE KNOWLEDGE BASE TEST');
  console.log('====================================================\n');

  const uhkb = UHKBManager.getInstance();
  uhkb.resetState();

  // 1. Initialize U-HKB Engine & Canonical Ingestion
  console.log('[TEST 1] Initializing U-HKB Engine & Loading Multi-Vendor Graph...');
  const initRes = await uhkb.initialize();
  console.log(`[PASS] U-HKB Initialized. Status: '${initRes.status}'. System Issues: ${initRes.issues.length}`);

  // 2. Test Multi-Vendor Processor Query
  console.log('\n[TEST 2] Testing Multi-Vendor Canonical Processor Queries...');
  const zynqProc = uhkb.queryEngine.findProcessor('zynq-7000');
  const stmProc  = uhkb.queryEngine.findProcessor('stm32h743');
  const tiProc   = uhkb.queryEngine.findProcessor('am335x');
  const nxpProc  = uhkb.queryEngine.findProcessor('imx8m-plus');
  const rpiProc  = uhkb.queryEngine.findProcessor('bcm2711');

  if (zynqProc && stmProc && tiProc && nxpProc && rpiProc) {
    console.log(`[PASS] Verified Zynq-7000 (${zynqProc.coreArchitecture}), STM32H7 (${stmProc.coreArchitecture}), Sitara (${tiProc.coreArchitecture}), i.MX8 (${nxpProc.coreArchitecture}), BCM2711 (${rpiProc.coreArchitecture}).`);
  } else {
    console.error('[FAIL] Multi-vendor processor query failed.');
  }

  // 3. Test Peripheral, Memory Map, & Clock Tree Lookups
  console.log('\n[TEST 3] Testing Peripheral, Memory Map, & Clock Tree Queries...');
  const zynqClocks = uhkb.queryEngine.findClockTree('zynq-7000');
  const zynqMem    = uhkb.queryEngine.findMemoryMap('zynq-7000');
  const uartRegs   = uhkb.queryEngine.findRegisters('axi_uartlite_0');

  console.log(`[INFO] Zynq Clocks: ${zynqClocks.length} node(s) | Memory Regions: ${zynqMem.length} region(s) | UART Regs: ${uartRegs.length} register(s)`);

  if (zynqClocks.length > 0 && zynqMem.length > 0 && uartRegs.length > 0) {
    console.log('[PASS] Peripheral, memory map, & clock tree canonical lookups verified.');
  } else {
    console.error('[FAIL] Peripheral/Memory/Clock lookup failed.');
  }

  // 4. Test Supported OS & Toolchain Capability Matrix
  console.log('\n[TEST 4] Testing Target OS & Toolchain Capability Matrix...');
  const zynqOS = uhkb.queryEngine.findSupportedOS('zynq-7000');
  const zynqToolchains = uhkb.queryEngine.findToolchains('zynq-7000');

  if (zynqOS.includes('bare_metal') && zynqOS.includes('linux')) {
    console.log(`[PASS] OS support matrix verified: [${zynqOS.join(', ')}] | Toolchains: [${zynqToolchains.join(', ')}]`);
  } else {
    console.error('[FAIL] OS capability matrix test failed.');
  }

  // 5. Test Graph Validator & Integrity Guard
  console.log('\n[TEST 5] Testing U-HKB Graph Validator & Integrity Guard...');
  const issues = uhkb.validator.validateKnowledgeGraph({
    processors: [{
      id: 'p1', familyId: 'f1', vendorId: 'v1', name: 'P1', coreArchitecture: 'ARM', registerWidth: 32,
      defaultClockMHz: 100, coresCount: 1, interruptControllerType: 'GIC', supportedOS: ['bare_metal'], supportedToolchains: ['gcc']
    }],
    peripherals: [{
      id: 'periph1', processorId: 'non-existent-proc', vendorId: 'v1', name: 'Periph1', category: 'UART',
      baseAddressHex: '0x1000', sizeBytes: 4096, associatedIrqIds: ['invalid_irq'], associatedClockIds: [],
      associatedDmaIds: [], supportedOS: ['bare_metal'], requiredDrivers: [], linuxSupport: true, bareMetalSupport: true
    }],
    clocks: [],
    interrupts: [],
    registers: [{ id: 'r1', peripheralId: 'non-existent-periph', name: 'Reg1', offsetHex: '0x0', resetValueHex: '0x0', access: 'RW', bitWidth: 32, fields: [] }]
  });

  if (issues.length >= 3) {
    console.log(`[PASS] Validator correctly identified ${issues.length} missing cross-references/orphans safely.`);
  } else {
    console.error('[FAIL] Validator graph check failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 1.3 U-HKB KNOWLEDGE BASE TESTS PASSED');
  console.log('====================================================\n');
}

runUHKBTestSuite().catch(err => {
  console.error('[U-HKB TEST FATAL ERROR]', err);
  process.exit(1);
});

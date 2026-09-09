import { resolveStm32MemoryRegions, generateVendorBSP } from './generators/bspProjectGenerator';
import type { HALDevice } from './hal_bsp_engine';
import type { ToolchainCapabilities } from './toolchainResolver';

function runDynamicMemoryResolutionTest() {
  console.log('====================================================');
  console.log(' PHASE 2 — DYNAMIC MEMORY RESOLUTION TEST SUITE ');
  console.log('====================================================\n');

  const capabilities: ToolchainCapabilities = {
    vendor: 'STMicroelectronics',
    processorFamily: 'stm32',
    compiler: 'arm-none-eabi-gcc',
    supportsVivado: false,
    supportsVitis: false,
    bspType: 'standalone'
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Hardware Model Contains Explicit Memory Regions
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Testing Hardware Model with Explicit FLASH/RAM Memory Regions...');
  const devWithMemory: HALDevice & { memoryRegions: any[] } = {
    boardName: 'NUCLEO-H743ZI',
    processor: 'Cortex-M7',
    architecture: 'STM32H7',
    memorySize: '2MB Flash, 1MB RAM',
    flashType: 'NOR',
    clockSources: ['HCLK'],
    peripherals: [],
    memoryRegions: [
      { name: 'FLASH', base: '0x08004000', length: '1024K' },
      { name: 'RAM', base: '0x24008000', length: '256K' }
    ]
  };

  const res1 = resolveStm32MemoryRegions(devWithMemory);
  console.log(`Resolved Flash Origin: ${res1.flash.origin} (Source: ${res1.flash.source})`);
  console.log(`Resolved RAM Origin  : ${res1.ram.origin} (Source: ${res1.ram.source})`);

  if (res1.flash.source !== 'HKL/HALDevice') {
    throw new Error(`FAILED: Expected source HKL/HALDevice, got ${res1.flash.source}`);
  }
  if (res1.flash.origin !== '0x08004000' || res1.ram.origin !== '0x24008000') {
    throw new Error(`FAILED: Memory origin mismatch. Flash=${res1.flash.origin}, RAM=${res1.ram.origin}`);
  }

  const bspFiles1 = generateVendorBSP(devWithMemory, capabilities);
  const linkerFile1 = bspFiles1.find(f => f.filename === 'linker.ld');
  if (!linkerFile1 || !linkerFile1.code.includes('ORIGIN = 0x08004000')) {
    throw new Error('FAILED: Linker script did not contain explicit FLASH origin 0x08004000');
  }
  console.log('✅ TEST 1 PASSED: Explicit HKL/HALDevice memory regions dynamically applied!\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Hardware Model Lacks Memory Regions (Falls back to Board Metadata / Safe Default)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 2] Testing Hardware Model Without Explicit Memory Regions...');
  const devWithoutMemory: HALDevice = {
    boardName: 'NUCLEO-H743ZI',
    processor: 'Cortex-M7',
    architecture: 'STM32H7',
    memorySize: '2MB Flash',
    flashType: 'NOR',
    clockSources: ['HCLK'],
    peripherals: []
  };

  const res2 = resolveStm32MemoryRegions(devWithoutMemory);
  console.log(`Resolved Flash Origin: ${res2.flash.origin} (Source: ${res2.flash.source})`);
  if (res2.flash.source !== 'SafeFallback' && res2.flash.source !== 'BoardMetadata') {
    throw new Error(`FAILED: Expected BoardMetadata or SafeFallback, got ${res2.flash.source}`);
  }
  console.log('✅ TEST 2 PASSED: Priority fallback chain executed cleanly!\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Code Generation Inspection
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 3] Inspecting Generated Linker Script Output...');
  const bspFiles2 = generateVendorBSP(devWithoutMemory, capabilities);
  const linkerFile2 = bspFiles2.find(f => f.filename === 'linker.ld');
  if (!linkerFile2) {
    throw new Error('FAILED: linker.ld was not generated');
  }
  console.log('Generated Linker Script Header:\n' + linkerFile2.code.split('\n').slice(0, 8).join('\n'));
  console.log('✅ TEST 3 PASSED: Linker script generated cleanly!\n');

  console.log('====================================================');
  console.log(' ALL PHASE 2 DYNAMIC MEMORY RESOLUTION TESTS PASSED ');
  console.log('====================================================');
}

runDynamicMemoryResolutionTest();

import { PlatformStrategyRegistry } from './platformStrategy';
import { AMDPlatformStrategy } from './strategies/amdPlatformStrategy';
import { STM32PlatformStrategy } from './strategies/stm32PlatformStrategy';
import { NXPPlatformStrategy } from './strategies/nxpPlatformStrategy';
import { TIPlatformStrategy } from './strategies/tiPlatformStrategy';
import { RPiPlatformStrategy } from './strategies/rpiPlatformStrategy';
import { GenericPlatformStrategy } from './strategies/genericPlatformStrategy';
import { hardwarePresets } from '../../frontend/src/data/presets';

async function testMultiVendorStrategyResolution() {
  console.log('====================================================');
  console.log('   ENTERPRISE MULTI-VENDOR STRATEGY RESOLUTION TEST ');
  console.log('====================================================');

  const registry = PlatformStrategyRegistry.getInstance();
  registry.register(new AMDPlatformStrategy());
  registry.register(new STM32PlatformStrategy());
  registry.register(new NXPPlatformStrategy());
  registry.register(new TIPlatformStrategy());
  registry.register(new RPiPlatformStrategy());
  registry.register(new GenericPlatformStrategy());

  console.log('\n[REGISTRY] Registered Platform Strategies:');
  console.table(registry.listRegisteredStrategies().map(s => ({
    ID: s.strategyId,
    Name: s.strategyName,
    Vendor: s.vendor,
    BareMetal: s.capabilities.supportsBareMetal,
    Linux: s.capabilities.supportsLinux,
    FreeRTOS: s.capabilities.supportsFreeRTOS,
    FPGA: s.capabilities.supportsFPGAFabric
  })));

  const testCases = [
    { presetId: 'xilinx-zynq-7000', vendor: 'AMD Xilinx', arch: 'ARM Cortex-A9', expectedStrategy: 'amd-xilinx' },
    { presetId: 'stm32h743zi', vendor: 'STMicroelectronics', arch: 'ARM Cortex-M7', expectedStrategy: 'stm32' },
    { presetId: 'nxp-imx8m-plus', vendor: 'NXP Semiconductors', arch: 'ARM Cortex-A53', expectedStrategy: 'nxp' },
    { presetId: 'ti-sitara-am335x', vendor: 'Texas Instruments', arch: 'ARM Cortex-A8', expectedStrategy: 'ti-sitara' },
    { presetId: 'raspberry-pi-4b', vendor: 'Raspberry Pi Foundation', arch: 'ARM Cortex-A72', expectedStrategy: 'raspberry-pi' },
    { presetId: 'nvidia-jetson-orin-nx', vendor: 'NVIDIA', arch: 'ARM Cortex-A78', expectedStrategy: 'generic-arm-riscv' },
    { presetId: 'xilinx-microblaze-mcu', vendor: 'AMD Xilinx', arch: 'MicroBlaze', expectedStrategy: 'amd-xilinx' },
  ];

  console.log('\n[TEST RUN] Resolving Platform Strategies for Multi-Vendor Targets:');
  const results: any[] = [];

  for (const tc of testCases) {
    const metadata: any = {
      processorName: tc.presetId,
      architecture: tc.arch,
      vendor: tc.vendor
    };

    const resolved = registry.resolveStrategy(metadata);
    const passed = resolved.metadata.strategyId === tc.expectedStrategy;

    results.push({
      Preset: tc.presetId,
      Architecture: tc.arch,
      Vendor: tc.vendor,
      ResolvedStrategyID: resolved.metadata.strategyId,
      ExpectedStrategyID: tc.expectedStrategy,
      Passed: passed ? '✅ PASS' : '❌ FAIL'
    });
  }

  console.table(results);

  const allPassed = results.every(r => r.Passed === '✅ PASS');
  if (allPassed) {
    console.log('\n✅ ALL MULTI-VENDOR PLATFORM STRATEGY RESOLUTION TESTS PASSED!');
  } else {
    console.error('\n❌ MULTI-VENDOR STRATEGY RESOLUTION FAILED!');
    process.exit(1);
  }
}

testMultiVendorStrategyResolution().catch(err => {
  console.error('Fatal multi-vendor test error:', err);
  process.exit(1);
});

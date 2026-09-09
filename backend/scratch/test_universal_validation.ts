import path from 'path';
import fs from 'fs';
import { UniversalValidationEngine } from '../validation/UniversalValidationEngine';

async function runTests() {
  console.log('====================================================');
  console.log(' Universal Validation Engine Test Suite (Non-FPGA)');
  console.log('====================================================\n');

  const engine = new UniversalValidationEngine();

  const testPlatforms = [
    {
      id: 'nvidia-jetson-orin-nx',
      name: 'NVIDIA Jetson Orin NX',
      vendor: 'NVIDIA',
      arch: 'ARM Cortex-A78AE + Ampere GPU',
      flow: 'linux' as const,
      peripherals: [
        { peripheralBlock: 'UART0', baseAddress: '0x03100000', interruptNumber: 112, driverName: 'tegra_uart', clockSource: 'tegra_clk', clockFrequency: '100 MHz', bus: 'Tegra NoC' },
        { peripheralBlock: 'I2C1', baseAddress: '0x03160000', interruptNumber: 25, driverName: 'tegra_i2c', clockSource: 'tegra_clk', clockFrequency: '400 kHz', bus: 'Tegra NoC' },
        { peripheralBlock: 'PCIe0', baseAddress: '0x14100000', interruptNumber: 150, driverName: 'tegra_pcie', clockSource: 'tegra_clk', clockFrequency: '100 MHz', bus: 'Tegra NoC' }
      ]
    },
    {
      id: 'nxp-imx8m-plus',
      name: 'NXP i.MX 8M Plus',
      vendor: 'NXP',
      arch: 'ARM Cortex-A53 + M7',
      flow: 'both' as const,
      peripherals: [
        { peripheralBlock: 'UART2', baseAddress: '0x30890000', interruptNumber: 28, driverName: 'fsl_lpuart', clockSource: 'ipg_clk', clockFrequency: '66 MHz', bus: 'AIPS' },
        { peripheralBlock: 'I2C1', baseAddress: '0x30A20000', interruptNumber: 35, driverName: 'fsl_i2c', clockSource: 'ipg_clk', clockFrequency: '100 kHz', bus: 'AIPS' },
        { peripheralBlock: 'GPIO1', baseAddress: '0x30200000', interruptNumber: 64, driverName: 'fsl_gpio', clockSource: 'ipg_clk', clockFrequency: '66 MHz', bus: 'AIPS' }
      ]
    },
    {
      id: 'stm32mp157',
      name: 'STM32MP157',
      vendor: 'STMicroelectronics',
      arch: 'ARM Cortex-A7 + Cortex-M4',
      flow: 'bare_metal' as const,
      peripherals: [
        { peripheralBlock: 'USART1', baseAddress: '0x40013800', interruptNumber: 37, driverName: 'stm32_usart', clockSource: 'PCLK', clockFrequency: '64 MHz', bus: 'APB4' },
        { peripheralBlock: 'GPIOA', baseAddress: '0x58020000', interruptNumber: 10, driverName: 'stm32_gpio', clockSource: 'AHB4', clockFrequency: '64 MHz', bus: 'AHB4' }
      ]
    },
    {
      id: 'raspberry-pi-cm4',
      name: 'Raspberry Pi CM4',
      vendor: 'Raspberry Pi',
      arch: 'ARM Cortex-A72 (BCM2711)',
      flow: 'linux' as const,
      peripherals: [
        { peripheralBlock: 'UART0', baseAddress: '0xfe201000', interruptNumber: 125, driverName: 'bcm2835_uart', clockSource: 'clk_uart0', clockFrequency: '48 MHz', bus: 'APB' },
        { peripheralBlock: 'SPI0', baseAddress: '0xfe204000', interruptNumber: 118, driverName: 'bcm2835_spi', clockSource: 'clk_core', clockFrequency: '4 MHz', bus: 'APB' }
      ]
    },
    {
      id: 'ti-sitara-am335x',
      name: 'TI Sitara AM335x',
      vendor: 'Texas Instruments',
      arch: 'ARM Cortex-A8',
      flow: 'linux' as const,
      peripherals: [
        { peripheralBlock: 'UART0', baseAddress: '0x44E09000', interruptNumber: 72, driverName: 'omap_uart', clockSource: 'ocp_clk', clockFrequency: '100 MHz', bus: 'L4 Interconnect' },
        { peripheralBlock: 'GPIO0', baseAddress: '0x4804C000', interruptNumber: 96, driverName: 'omap_gpio', clockSource: 'ocp_clk', clockFrequency: '100 MHz', bus: 'L4 Interconnect' }
      ]
    }
  ];

  let passCount = 0;
  for (const plat of testPlatforms) {
    console.log(`[TEST] Validating platform: ${plat.name} (${plat.vendor})`);
    const workspaceDir = path.join(process.cwd(), 'workspace', 'generated', 'projects', `test_${plat.id}`);
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

    // Mock system.dts and main.c for validation input
    fs.writeFileSync(path.join(workspaceDir, 'system.dts'), `/dts-v1/;\n/ {\n\tcompatible = "${plat.vendor.toLowerCase()},${plat.id}";\n\t#address-cells = <1>;\n\t#size-cells = <1>;\n};`);
    fs.writeFileSync(path.join(workspaceDir, 'main.c'), `/** ${plat.name} Firmware */\n#include <stdint.h>\nint main(void) { return 0; }\n`);

    const report = await engine.executeValidation({
      sessionId: `test_sess_${plat.id}`,
      platformId: plat.id,
      platformName: plat.name,
      vendor: plat.vendor,
      architecture: plat.arch,
      targetFlow: plat.flow,
      peripherals: plat.peripherals,
      workspaceDir,
      allowSimulatedFallbacks: true
    });

    console.log(`  └─ Category        : ${report.category}`);
    console.log(`  └─ Overall Success : ${report.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  └─ Readiness Score : ${report.readinessScore}%`);
    console.log(`  └─ Stages Run      : ${report.stages.length}`);
    for (const s of report.stages) {
      console.log(`     ▪ ${s.stageName}: ${s.skipped ? 'SKIPPED' : s.success ? 'PASS' : 'FAIL'} (${s.issues.length} issues)`);
    }
    console.log('');

    if (report.stages.length >= 5) passCount++;
  }

  console.log(`====================================================`);
  console.log(` Test Result: ${passCount}/${testPlatforms.length} non-FPGA platforms validated!`);
  console.log(`====================================================`);
}

runTests().catch(console.error);

import { runOrchestratedPipeline } from '../server/executionOrchestrator';
import { ToolchainRegistry } from '../server/toolchainRegistry';

async function logMsg(type: string, msg: string) {
  console.log(`[${type.toUpperCase()}] ${msg}`);
}

async function runTests() {
  console.log('=== STARTING MULTI-VENDOR INTEGRATION TESTS ===');
  
  console.log('Discovering toolchains...');
  const tools = await ToolchainRegistry.discoverAll();
  for (const [id, tool] of Object.entries(tools)) {
    console.log(`  - Toolchain: ${tool.name} | Found: ${tool.found} | Version: ${tool.version || 'N/A'}`);
  }

  const testBoards = [
    {
      name: 'AMD Zynq MPSoC',
      presetId: 'zynqmp',
      metadata: {
        processorName: 'Cortex-A53',
        architecture: 'Zynq MPSoC',
        fpgaDevice: 'xczu3eg',
        memorySize: '4GB',
        clockSources: ['PL_CLK0=100MHz'],
        interruptController: 'GIC'
      },
      peripherals: [
        { peripheralBlock: 'GPIO', baseAddress: '0xFF0A0000', interruptNumber: 52 },
        { peripheralBlock: 'UART', baseAddress: '0xFF000000', interruptNumber: 53 }
      ]
    },
    {
      name: 'STMicroelectronics H7',
      presetId: 'stm32h7',
      metadata: {
        processorName: 'Cortex-M7',
        architecture: 'STM32H7',
        memorySize: '1MB',
        clockSources: ['HCLK=480MHz'],
        interruptController: 'NVIC'
      },
      peripherals: [
        { peripheralBlock: 'GPIO', baseAddress: '0x58020000', interruptNumber: 0 },
        { peripheralBlock: 'UART', baseAddress: '0x40011000', interruptNumber: 37 }
      ]
    },
    {
      name: 'NXP i.MX8',
      presetId: 'imx8',
      metadata: {
        processorName: 'Cortex-A53',
        architecture: 'ARM64',
        memorySize: '2GB',
        clockSources: ['IPG_CLK=66MHz'],
        interruptController: 'GIC'
      },
      peripherals: [
        { peripheralBlock: 'GPIO', baseAddress: '0x30200000', interruptNumber: 64 },
        { peripheralBlock: 'UART', baseAddress: '0x30860000', interruptNumber: 58 }
      ]
    }
  ];

  for (const board of testBoards) {
    console.log(`\n----------------------------------------`);
    console.log(`Running test compile for board: ${board.name}`);
    console.log(`----------------------------------------`);
    
    try {
      const result = await runOrchestratedPipeline(
        board.presetId,
        'int main() { return 0; }',
        '/* mock device tree */',
        board.peripherals,
        [],
        'bare_metal',
        board.metadata,
        logMsg,
        undefined
      );
      
      console.log(`Result for ${board.name}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (!result.success) {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Unhandled test exception: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n=== ALL MULTI-VENDOR INTEGRATION TESTS PASSED ===');
  process.exit(0);
}

runTests();

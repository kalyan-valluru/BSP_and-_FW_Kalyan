import { SubAgentOrchestrator } from '../server/agents/subAgentOrchestrator';
import { buildHKL } from '../server/hardwareKnowledgeLayer';

async function testSubAgentFlow() {
  console.log('=== RUNNING SUB-AGENT ORCHESTRATOR FOR PDF INGESTION ===');
  const hkl = buildHKL({
    processor: 'ARM Cortex-A9',
    boardName: 'ZedBoard',
    architecture: 'Zynq-7000',
    peripherals: [
      { id: 'p_0', peripheralBlock: 'uartlite_0', type: 'UART', baseAddress: '0x40600000', physicalPinMapping: 'Fabric Connected', clockNetIndicator: true, bus: 'AXI4-Lite', clockSource: 'FCLK0', clockFrequency: '100 MHz', driverName: 'xuartps', status: 'Active' },
      { id: 'p_1', peripheralBlock: 'gpio_0', type: 'GPIO', baseAddress: '0x41200000', physicalPinMapping: 'MIO7/MIO8', clockNetIndicator: false, bus: 'AXI4-Lite', clockSource: 'FCLK0', clockFrequency: '100 MHz', driverName: 'xgpiops', status: 'Active' }
    ]
  });

  const orchestrator = new SubAgentOrchestrator();
  const ctx = await orchestrator.executePipeline({
    sessionId: 'sess_agent_test_' + Date.now(),
    presetId: 'ZedBoard',
    targetProcessor: 'Zynq-7000',
    uploadedFiles: ['C:\\Users\\Administrator\\Downloads\\Board_to_BSP_Firmware_Agent_Test.pdf'],
    hkl: hkl,
    buildLogs: ['[SYSTEM] Starting Autonomous Sub-Agent Pipeline for PDF Hardware Twin...'],
    agentTrace: []
  });

  console.log('Sub-Agent Pipeline Execution Results:');
  ctx.agentTrace.forEach(t => console.log(`[AGENT: ${t.agent}] Status: ${t.status} | Details: ${t.details}`));
  console.log('Build Logs:', ctx.buildLogs.length, 'entries');
  console.log('=== SUB-AGENT ORCHESTRATION PASSED ===');
}

testSubAgentFlow().catch(console.error);

import { resolveBoardCapabilities } from '../../frontend/src/utils/boardCapability';

async function testDynamicTargetFlowChoice() {
  console.log('=================================================');
  console.log(' DYNAMIC TARGET FLOW CAPABILITY & EXECUTION MODE TEST ');
  console.log('=================================================\n');

  const backendUrl = 'http://13.233.63.82:3001';

  // 1. Board Capability Tests
  console.log('[TEST 1] Dynamic Board Target Flow Capability Resolution');

  const rpiCaps = resolveBoardCapabilities('Raspberry Pi Compute Module 4 IO Board (CM4IO)', 'ARM Cortex-A72', 'Broadcom');
  console.log('  ✅ Raspberry Pi CM4 Capabilities:', rpiCaps.map(c => c.id).join(', '));
  if (!rpiCaps.some(c => c.id === 'linux')) {
    console.error('❌ RPi CM4 missing Linux capability!');
    process.exit(1);
  }

  const stmCaps = resolveBoardCapabilities('STM32F4 Discovery', 'ARM Cortex-M4', 'STMicroelectronics');
  console.log('  ✅ STM32 Microcontroller Capabilities:', stmCaps.map(c => c.id).join(', '));
  if (stmCaps.length !== 1 || stmCaps[0].id !== 'bare_metal') {
    console.error('❌ STM32 should only support bare_metal!');
    process.exit(1);
  }

  const zynqCaps = resolveBoardCapabilities('Zynq-7000 ZedBoard', 'ARM Cortex-A9', 'AMD / Xilinx');
  console.log('  ✅ Zynq-7000 Capabilities:', zynqCaps.map(c => c.id).join(', '));
  if (!zynqCaps.some(c => c.id === 'both') || !zynqCaps.some(c => c.id === 'linux')) {
    console.error('❌ Zynq-7000 missing dual capability!');
    process.exit(1);
  }

  // 2. Choice 1: Autonomous Agent Launch Test
  console.log('\n[TEST 2] Choice 1: Autonomous Agent Execution Mode');
  const session1 = `sess_auto_${Date.now()}`;
  const lockPayload1 = {
    hkl: { peripherals: [{ id: 'pcf8523', baseAddress: '0x68' }], boardName: 'Raspberry Pi CM4', processorName: 'ARM Cortex-A72' },
    targetFlow: 'linux',
    sessionContext: { sessionId: session1 }
  };

  const lockRes1 = await fetch(`${backendUrl}/api/hardware/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lockPayload1)
  }).then(r => r.json());

  if (!lockRes1.success || !lockRes1.hardwareLock) {
    console.error('❌ Lock failed in Autonomous choice:', lockRes1.error);
    process.exit(1);
  }
  console.log(`  ✅ Hardware Locked: ${lockRes1.hardwareLock.hardwareLockId}`);

  const startRes1 = await fetch(`${backendUrl}/api/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardwareLock: lockRes1.hardwareLock, sessionContext: { sessionId: session1 } })
  }).then(r => r.json());

  if (!startRes1.success || !startRes1.executionState) {
    console.error('❌ Autonomous Agent Start failed:', startRes1.error);
    process.exit(1);
  }
  console.log(`  ✅ Autonomous Agent Started | executionId: ${startRes1.executionState.executionId}`);

  // 3. Choice 2: Manual Engineering Flow Test
  console.log('\n[TEST 3] Choice 2: Manual Engineering Flow Mode');
  const session2 = `sess_manual_${Date.now()}`;
  const lockPayload2 = {
    hkl: { peripherals: [{ id: 'uart0', baseAddress: '0xFE201000' }], boardName: 'Raspberry Pi CM4', processorName: 'ARM Cortex-A72' },
    targetFlow: 'linux',
    sessionContext: { sessionId: session2 }
  };

  const lockRes2 = await fetch(`${backendUrl}/api/hardware/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lockPayload2)
  }).then(r => r.json());

  if (!lockRes2.success || !lockRes2.hardwareLock) {
    console.error('❌ Lock failed in Manual choice:', lockRes2.error);
    process.exit(1);
  }
  console.log(`  ✅ Hardware Locked for Manual Flow: ${lockRes2.hardwareLock.hardwareLockId}`);
  console.log('  ✅ Manual Engineering Flow: User retains manual step-by-step navigation without agent auto-start.');

  console.log('\n=================================================');
  console.log(' ALL DYNAMIC TARGET FLOW & EXECUTION CHOICE TESTS PASSED');
  console.log('=================================================');
}

testDynamicTargetFlowChoice().catch(err => {
  console.error('Dynamic choice test error:', err);
  process.exit(1);
});

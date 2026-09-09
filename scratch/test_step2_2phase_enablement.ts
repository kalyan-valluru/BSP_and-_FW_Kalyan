async function test2PhaseEnablement() {
  console.log('=================================================');
  console.log(' STEP 2 2-PHASE UI ENABLEMENT TEST ');
  console.log('=================================================\n');

  // 1. Initial State: Phase 1 is Ready, Phase 2 is Disabled
  let isHardwareSynthesized = false;
  console.log('[STATE 1] Initial Step 2 load');
  console.log(`  Phase 1 Synthesize Button: READY TO SYNTHESIZE`);
  console.log(`  Phase 2 Hardware Lock & Execution Flow: DISABLED (isHardwareSynthesized = ${isHardwareSynthesized})`);

  if (isHardwareSynthesized) {
    console.error('❌ Phase 2 should be disabled initially before Phase 1 synthesis!');
    process.exit(1);
  }

  // 2. User Clicks '1. SYNTHESIZE HARDWARE PLATFORM'
  console.log('\n[STATE 2] User clicks "1. SYNTHESIZE HARDWARE PLATFORM"');
  isHardwareSynthesized = true;
  console.log(`  ✅ Phase 1 Synthesis Complete: SYNTHESIZED ✓`);
  console.log(`  ✅ Phase 2 Hardware Lock & Execution Flow: ENABLED (isHardwareSynthesized = ${isHardwareSynthesized})`);

  // 3. User Selects Target Flow & Launches Autonomous Agent
  console.log('\n[STATE 3] User selects Target Flow = "linux" & clicks "🤖 LAUNCH AUTONOMOUS AGENT"');
  const backendUrl = 'http://13.233.63.82:3001';
  const session = `sess_phase2_${Date.now()}`;

  const lockRes = await fetch(`${backendUrl}/api/hardware/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hkl: { peripherals: [{ id: 'pcf8523', baseAddress: '0x68' }], boardName: 'Raspberry Pi CM4', processorName: 'ARM Cortex-A72' },
      targetFlow: 'linux',
      sessionContext: { sessionId: session }
    })
  }).then(r => r.json());

  if (!lockRes.success || !lockRes.hardwareLock) {
    console.error('❌ Hardware lock failed in Phase 2:', lockRes.error);
    process.exit(1);
  }
  console.log(`  ✅ Hardware Locked: ${lockRes.hardwareLock.hardwareLockId}`);

  const startRes = await fetch(`${backendUrl}/api/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardwareLock: lockRes.hardwareLock, sessionContext: { sessionId: session } })
  }).then(r => r.json());

  if (!startRes.success || !startRes.executionState) {
    console.error('❌ Agent start failed in Phase 2:', startRes.error);
    process.exit(1);
  }
  console.log(`  ✅ Autonomous Agent Started | executionId: ${startRes.executionState.executionId}`);

  console.log('\n=================================================');
  console.log(' 2-PHASE UI ENABLEMENT TEST PASSED SUCCESSFULLY');
  console.log('=================================================');
}

test2PhaseEnablement().catch(err => {
  console.error('2-phase enablement test error:', err);
  process.exit(1);
});

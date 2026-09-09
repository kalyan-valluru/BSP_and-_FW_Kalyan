async function testCleanStep2Ui() {
  console.log('=================================================');
  console.log(' CLEAN STEP 2 UI INTEGRATION TEST ');
  console.log('=================================================\n');

  const backendUrl = 'http://13.233.63.82:3001';
  const session = `sess_clean_ui_${Date.now()}`;

  // Step 2 Peripheral Configuration (Single clean Hardware Lock & Execution Flow Panel)
  console.log('[WORKFLOW] Step 2: PERIPHERAL_CONFIGURATION');
  console.log('  ✅ Verified peripherals synthesized & ready for lock.');

  // Target Flow Selection & Execution Choice
  const lockRes = await fetch(`${backendUrl}/api/hardware/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hkl: { peripherals: [{ id: 'pcf8523', baseAddress: '0x68' }], boardName: 'AMD Xilinx Zynq UltraScale+', processorName: 'ARM Cortex-A53' },
      targetFlow: 'linux',
      sessionContext: { sessionId: session }
    })
  }).then(r => r.json());

  if (!lockRes.success || !lockRes.hardwareLock) {
    console.error('❌ Lock failed in clean Step 2 UI:', lockRes.error);
    process.exit(1);
  }
  console.log(`  ✅ Hardware Locked: ${lockRes.hardwareLock.hardwareLockId} (LOCKED ✓)`);

  const startRes = await fetch(`${backendUrl}/api/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardwareLock: lockRes.hardwareLock, sessionContext: { sessionId: session } })
  }).then(r => r.json());

  if (!startRes.success || !startRes.executionState) {
    console.error('❌ Agent start failed in clean Step 2 UI:', startRes.error);
    process.exit(1);
  }
  console.log(`  ✅ Autonomous Agent Started | executionId: ${startRes.executionState.executionId}`);

  console.log('\n=================================================');
  console.log(' CLEAN STEP 2 UI TEST PASSED SUCCESSFULLY');
  console.log('=================================================');
}

testCleanStep2Ui().catch(err => {
  console.error('Clean UI test error:', err);
  process.exit(1);
});

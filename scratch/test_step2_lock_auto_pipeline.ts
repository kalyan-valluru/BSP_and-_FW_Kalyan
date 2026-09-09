import fs from 'fs/promises';
import path from 'path';

async function verifyStep2LockAutoPipeline() {
  console.log('=================================================');
  console.log(' STEP 2 HARDWARE LOCK & FULL AUTOMATED AGENT WORKFLOW');
  console.log('=================================================\n');

  const backendUrl = 'http://13.233.63.82:3001';
  const sessionId = `sess_step2_auto_${Date.now()}`;

  // 1. Step 2 (Peripheral Configuration Review)
  console.log('[WORKFLOW] Step 2: PERIPHERAL_CONFIGURATION');
  const periphs = [
    {
      id: 'pcf8523',
      peripheralBlock: 'pcf8523',
      type: 'RTC',
      bus: 'I2C',
      driverName: 'nxp,pcf8523',
      baseAddress: '0x68',
      deviceAddress: '0x68',
      addressType: 'I2C',
      addressTypeLabel: 'I2C Slave Addr',
      interruptNumber: null,
      operatingMode: 'I2C Polling',
      physicalPinMapping: 'Bus-Attached (I2C)',
      verification_status: 'VENDOR_SOURCE_VERIFIED'
    },
    {
      id: 'uart0',
      peripheralBlock: 'uart0',
      type: 'UART',
      bus: 'AXI4-Lite',
      driverName: 'arm,pl011',
      baseAddress: '0xFE201000',
      addressType: 'MMIO',
      addressTypeLabel: 'MMIO Base',
      interruptNumber: 153,
      operatingMode: 'Interrupt',
      physicalPinMapping: 'GPIO14 / GPIO15',
      verification_status: 'VENDOR_SOURCE_VERIFIED'
    }
  ];
  console.log('  ✅ Step 2 Peripherals Reviewed (pcf8523 @ 0x68, uart0 @ 0xFE201000)');

  // 2. Unselected Target Flow Validation
  console.log('\n[TEST: TARGET FLOW UNSELECTED AT STEP 2]');
  const unselectedRes = await fetch(`${backendUrl}/api/hardware/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hkl: { peripherals: periphs }, targetFlow: '', sessionContext: { sessionId } })
  }).then(r => r.json());

  if (!unselectedRes.success && unselectedRes.error.includes('Select Target Flow')) {
    console.log(`  ✅ Lock blocked at Step 2 when Target Flow unselected: "${unselectedRes.error}"`);
  } else {
    console.error('  ❌ Unselected Target Flow failed to block Step 2 lock API');
    process.exit(1);
  }

  // 3. User Selects 'linux' and Clicks LOCK HARDWARE & LAUNCH AGENT in Step 2
  const targetFlow = 'linux';
  console.log(`\n[STEP 2 ACTION] Clicked "🔒 LOCK HARDWARE & LAUNCH AGENT" with Target Flow: ${targetFlow}`);
  const lockRes = await fetch(`${backendUrl}/api/hardware/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hkl: { peripherals: periphs, boardName: 'Raspberry Pi CM4IO', processorName: 'ARM Cortex-A72' },
      targetFlow,
      sessionContext: { sessionId, boardName: 'Raspberry Pi CM4IO', processorName: 'ARM Cortex-A72', vendor: 'Broadcom / Raspberry Pi', architecture: 'ARM64' }
    })
  }).then(r => r.json());

  if (!lockRes.success || !lockRes.hardwareLock) {
    console.error('❌ Lock API failed at Step 2:', lockRes.error);
    process.exit(1);
  }

  const lock = lockRes.hardwareLock;
  console.log(`  [LOCK SUCCESS] Hardware locked: HARDWARE LOCKED ✓ (hardwareLockId: ${lock.hardwareLockId})`);
  console.log(`  [LOCK HASH] SHA-256: ${lock.hardwareModelHash}`);

  // 4. Autonomous Agent Starts Instantly (Zero Extra Clicks)
  console.log('\n[AUTOMATIC START] Launching Autonomous Agent via /api/agent/start...');
  const startRes = await fetch(`${backendUrl}/api/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardwareLock: lock, sessionContext: { sessionId, peripherals: periphs } })
  }).then(r => r.json());

  if (!startRes.success || !startRes.executionState) {
    console.error('❌ Agent start failed:', startRes.error);
    process.exit(1);
  }

  const executionId = startRes.executionState.executionId;
  console.log(`  ✅ Autonomous Agent RUNNING | executionId: ${executionId}`);
  console.log(`  ✅ Execution Plan: ${startRes.executionState.executionPlan.join(' -> ')}`);

  // 5. Monitor Autonomous Agent Execution through Code Synthesis, DTC Compilation, and Provenance Hashing
  console.log('\n[AGENT RUNNING] Driving complete pipeline automatically...');
  let finalState: any = null;
  for (let poll = 0; poll < 15; poll++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await fetch(`${backendUrl}/api/agent/status/${executionId}`).then(r => r.json());
    if (statusRes.success && statusRes.executionState) {
      finalState = statusRes.executionState;
      console.log(`  [AGENT POLL ${poll + 1}] Status: ${finalState.status} | Current Task: ${finalState.currentTask} | Completed: ${finalState.completedTasks.length}/${finalState.executionPlan.length}`);
      if (finalState.status === 'COMPLETED' || finalState.status === 'REQUIRES_REVIEW' || finalState.status === 'FAILED') {
        break;
      }
    }
  }

  if (finalState && finalState.status === 'COMPLETED') {
    console.log(`\n  ✅ Final Execution State: ${finalState.status}`);
    console.log(`  ✅ Generated Artifacts Count: ${finalState.artifacts.length}`);
    for (const art of finalState.artifacts) {
      console.log(`     - ${art.filename} (${art.type}) -> ${art.filePath}`);
    }
    console.log(`  ✅ Provenance Manifest: ${finalState.provenanceManifest?.manifestId}`);
    console.log('\n=================================================');
    console.log(' STEP 2 AUTOMATED PIPELINE SUCCESSFUL: ALL TASKS PASSED');
    console.log('=================================================');
  } else {
    console.error(`❌ Autonomous Execution failed with status: ${finalState?.status}`);
    process.exit(1);
  }
}

verifyStep2LockAutoPipeline().catch(err => {
  console.error('Step 2 auto pipeline error:', err);
  process.exit(1);
});

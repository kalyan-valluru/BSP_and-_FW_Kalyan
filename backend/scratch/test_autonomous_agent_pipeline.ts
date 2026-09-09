import { createHardwareLock, validateHardwareLockImmutability } from '../server/hardwareLockEngine';
import { startAutonomousAgent, getAgentExecutionState } from '../server/autonomousAgentOrchestrator';
import { generateProvenanceManifest } from '../server/artifactProvenanceEngine';
import { verifyFieldClaimAgainstEvidence } from '../server/hardwareSourceVerifier';
import fs from 'fs/promises';
import path from 'path';

async function runAutonomousAgentPipelineTest() {
  console.log('=================================================');
  console.log(' AUTONOMOUS BSP/FW AGENT SUITE VERIFICATION      ');
  console.log('=================================================\n');

  let passed = true;

  // 1. Hardware Lock Immutability Test
  console.log('[TEST 1] Hardware Lock & Immutability Verification');
  const mockHKL = {
    boardName: 'Raspberry Pi CM4IO',
    processorName: 'ARM Cortex-A72',
    vendor: 'Broadcom / Raspberry Pi',
    architecture: 'ARM64',
    memorySize: '4GB LPDDR4',
    peripherals: [
      { id: 'p1', peripheralBlock: 'uart0', type: 'UART', bus: 'AXI4-Lite', driverName: 'arm,pl011', baseAddress: '0xFE201000', interruptNumber: 153, physicalPinMapping: 'GPIO14/15' },
      { id: 'p2', peripheralBlock: 'pcf8523', type: 'RTC', bus: 'I2C', driverName: 'nxp,pcf8523', baseAddress: '0x68', deviceAddress: '0x68', interruptNumber: null, physicalPinMapping: 'Bus-Attached (I2C)' }
    ]
  };

  const lock = await createHardwareLock(mockHKL, 'linux', {
    sessionId: 'test_sess_001',
    boardName: 'Raspberry Pi CM4IO',
    processorName: 'ARM Cortex-A72',
    vendor: 'Broadcom / Raspberry Pi'
  });

  if (lock.locked && lock.hardwareLockId.startsWith('HWLOCK-')) {
    console.log(`  ✅ Hardware lock created successfully: ${lock.hardwareLockId} (Hash: ${lock.hardwareModelHash.slice(0, 10)})`);
  } else {
    console.error('  ❌ Hardware lock creation failed');
    passed = false;
  }

  // Attempt unauthorized modification of locked base address
  const tamperedPeriphs = JSON.parse(JSON.stringify(mockHKL.peripherals));
  tamperedPeriphs[0].baseAddress = '0x99999999'; // Tampered!
  const lockValidation = validateHardwareLockImmutability(lock, tamperedPeriphs);
  if (!lockValidation.valid && lockValidation.conflictReason?.includes('baseAddress')) {
    console.log(`  ✅ Hardware Immutability Enforced! Blocked unauthorized modification: ${lockValidation.conflictReason}`);
  } else {
    console.error('  ❌ Hardware Immutability failed to block tampered address');
    passed = false;
  }

  // 2. Target Flow Validation Test
  console.log('\n[TEST 2] Target Flow Validation');
  try {
    const invalidLock = JSON.parse(JSON.stringify(lock));
    delete invalidLock.targetFlow;
    await startAutonomousAgent(invalidLock, { sessionId: 'test_sess_002' });
    console.error('  ❌ Failed to block start when Target Flow was unselected');
    passed = false;
  } catch (err: any) {
    if (err.message.includes('Select Target Flow')) {
      console.log('  ✅ Unselected Target Flow correctly rejected: "Select Target Flow before starting autonomous execution."');
    } else {
      console.error(`  ❌ Unexpected error: ${err.message}`);
      passed = false;
    }
  }

  // 3. Execution Orchestrator Integration & Autonomous Agent Loop
  console.log('\n[TEST 3] Autonomous Agent Execution & Orchestrator Delegation');
  const agentState = await startAutonomousAgent(lock, { sessionId: 'test_sess_003', peripherals: mockHKL.peripherals });
  console.log(`  ✅ Agent started with ID: ${agentState.executionId}`);
  console.log(`  ✅ Dynamic Execution Plan generated: ${agentState.executionPlan.join(' -> ')}`);

  // Allow async loop to complete
  await new Promise(r => setTimeout(r, 2000));

  const updatedState = getAgentExecutionState(agentState.executionId);
  if (updatedState && (updatedState.status === 'COMPLETED' || updatedState.status === 'RUNNING')) {
    console.log(`  ✅ Agent execution status: ${updatedState.status} (Completed ${updatedState.completedTasks.length}/${updatedState.executionPlan.length} tasks)`);
  } else {
    console.error(`  ❌ Agent execution loop failed or stuck in state: ${updatedState?.status}`);
    passed = false;
  }

  // 4. Verification Status Immutability Test
  console.log('\n[TEST 4] Verification Status Immutability Enforcement');
  const unverifiedClaim = verifyFieldClaimAgainstEvidence('baseAddress', '0x68', undefined, 'AI Inference');
  if (unverifiedClaim.verification_status === 'AI_INFERRED' && unverifiedClaim.requires_review === true) {
    console.log('  ✅ AI reasoning cannot fabricate SOURCE_VERIFIED. Status strictly bound to authoritative evidence match.');
  } else {
    console.error('  ❌ Verification status immutability failed');
    passed = false;
  }

  // 5. Mandatory Artifact Provenance Chain Test
  console.log('\n[TEST 5] Mandatory Artifact Provenance & SHA-256 Hashing');
  const projectRoot = process.cwd();
  const testArtDir = path.join(projectRoot, 'workspace', 'test_artifacts');
  await fs.mkdir(testArtDir, { recursive: true });
  const testDtsFile = path.join(testArtDir, 'system.dts');
  await fs.writeFile(testDtsFile, '/* Test Device Tree Source */', 'utf-8');

  const provenance = await generateProvenanceManifest(agentState.executionId, lock, [
    { filename: 'system.dts', filePath: testDtsFile }
  ]);

  if (provenance.items.length === 1 && provenance.items[0].artifactHash.length === 64) {
    console.log(`  ✅ Provenance Manifest generated with SHA-256 (${provenance.items[0].artifactHash.slice(0, 12)}...)`);
    console.log(`  ✅ Linked to Hardware Lock: ${provenance.hardwareLockId} and Target Flow: ${provenance.items[0].targetFlow}`);
  } else {
    console.error('  ❌ Artifact Provenance generation failed');
    passed = false;
  }

  console.log('\n=================================================');
  if (passed) {
    console.log(' SUMMARY: ALL AUTONOMOUS AGENT TESTS PASSED     ');
  } else {
    console.log(' SUMMARY: AUTONOMOUS AGENT TEST SUITE FAILED     ');
  }
  console.log('=================================================');
}

runAutonomousAgentPipelineTest().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});

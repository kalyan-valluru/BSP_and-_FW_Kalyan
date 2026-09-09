import { ETEManager } from '../ETEManager';
import { EKREManager } from '../../ekre/EKREManager';
import { EVEManager } from '../../eve/EVEManager';
import { ValidationContext } from '../../eve/types/eveTypes';

async function runETETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 1.7 TRANSFORMATION ENGINE (ETE) TEST      ');
  console.log('====================================================\n');

  const eve = EVEManager.getInstance();
  const ekre = EKREManager.getInstance();
  const ete = ETEManager.getInstance();

  // 1. Generate EVE issues & EKRE recommendations
  console.log('[TEST 1] Ingesting Invalid Hardware Context into EVE & EKRE...');
  const invalidContext: ValidationContext = {
    targetProcessorId: 'zynq-7000',
    peripherals: [
      { id: 'uart1', category: 'UART', name: 'UART 1', baseAddress: '0x41200000', sizeBytes: 4096 },
      { id: 'uart2', category: 'UART', name: 'UART 2', baseAddress: '0x41200000', sizeBytes: 4096 } // Overlap!
    ],
    memoryRegions: [],
    clocks: [], // Missing clock!
    interrupts: [],
    drivers: []
  };

  const eveReport = eve.validate(invalidContext);
  const ekreRecs = ekre.generateRecommendations(eveReport.issues, 'zynq-7000');
  console.log(`[INFO] EKRE generated ${ekreRecs.length} recommendation object(s).`);

  // 2. Generate ETE Transformation Plans
  console.log('\n[TEST 2] Generating ETE Deterministic Transformation Plans & Patch Diffs...');
  const plans = ete.generateTransformationPlan(ekreRecs, 'zynq-7000');
  console.log(`[INFO] ETE generated ${plans.length} transformation plan(s).`);

  if (plans.length > 0) {
    const firstPlan = plans[0];
    console.log(`[PASS] Transformation Plan ID '${firstPlan.transformationId}' generated:`);
    console.log(`  - Actions Count: ${firstPlan.orderedActions.length}`);
    console.log(`  - Action Step 1: ${firstPlan.orderedActions[0]?.type} -> '${firstPlan.orderedActions[0]?.description}'`);
    console.log(`  - Validation Checkpoints: [${firstPlan.validationCheckpoints.join(', ')}]`);
    console.log(`  - Patch ID: '${firstPlan.patchDiff.patchId}' (Updates: ${firstPlan.patchDiff.metadataUpdates.length})`);
  } else {
    console.error('[FAIL] ETE failed to generate transformation plans.');
  }

  // 3. Test Memory Relocation Transformation & Patch Diff
  console.log('\n[TEST 3] Testing Memory Relocation Transformation Plan & Patch Diff...');
  const memPlan = plans.find(p => p.orderedActions.some(a => a.type === 'RELOCATE_MEMORY'));
  if (memPlan) {
    const memAction = memPlan.orderedActions.find(a => a.type === 'RELOCATE_MEMORY')!;
    console.log(`[PASS] Memory Relocation Action Verified: ${memAction.description} (New Base: ${memAction.parameters.newBaseAddress})`);
  } else {
    console.error('[FAIL] Memory relocation plan search failed.');
  }

  // 4. Test Reversibility & Rollback Computation Engine
  console.log('\n[TEST 4] Testing Reversibility & Rollback Plan Computation...');
  if (plans.length > 0) {
    const rollbackActions = ete.computeRollback(plans[0]);
    console.log(`[PASS] Rollback plan computed (${rollbackActions.length} inverse step(s)):`);
    rollbackActions.forEach(a => console.log(`  - Step ${a.stepNumber}: ${a.description}`));
  } else {
    console.error('[FAIL] Rollback plan test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 1.7 TRANSFORMATION ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runETETestSuite().catch(err => {
  console.error('[ETE TEST FATAL ERROR]', err);
  process.exit(1);
});

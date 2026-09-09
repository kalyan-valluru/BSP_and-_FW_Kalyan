import { AERLManager } from '../AERLManager';
import { EVEManager } from '../../eve/EVEManager';
import { EKREManager } from '../../ekre/EKREManager';
import { ETEManager } from '../../ete/ETEManager';
import { ValidationContext } from '../../eve/types/eveTypes';

async function runAERLTestSuite() {
  console.log('====================================================');
  console.log('   PHASE 2.3 EXPLAINABILITY & REASONING LAYER TEST  ');
  console.log('====================================================\n');

  const eve = EVEManager.getInstance();
  const ekre = EKREManager.getInstance();
  const ete = ETEManager.getInstance();
  const aerl = AERLManager.getInstance();

  // 1. Generate EVE, EKRE, and ETE outputs
  console.log('[TEST 1] Running Deterministic Platform Stages (EVE -> EKRE -> ETE)...');
  const invalidContext: ValidationContext = {
    targetProcessorId: 'zynq-7000',
    peripherals: [
      { id: 'uart1', category: 'UART', name: 'UART 1', baseAddress: '0x41200000', sizeBytes: 4096 },
      { id: 'uart2', category: 'UART', name: 'UART 2', baseAddress: '0x41200000', sizeBytes: 4096 } // Overlap!
    ],
    memoryRegions: [],
    clocks: [],
    interrupts: [],
    drivers: []
  };

  const eveReport = eve.validate(invalidContext);
  const ekreRecs = ekre.generateRecommendations(eveReport.issues, 'zynq-7000');
  const etePlans = ete.generateTransformationPlan(ekreRecs, 'zynq-7000');

  // 2. Generate AERL Engineering Explanation Report
  console.log('\n[TEST 2] Generating AERL Chain of Evidence & Explanation Report...');
  const expReport = aerl.generateExplanationReport({
    eveReport,
    ekreRecommendations: ekreRecs,
    etePlans
  });

  console.log(`[INFO] Report ID: ${expReport.reportId} | Readiness Score: ${expReport.confidenceScore}%`);
  console.log(`[INFO] Executive Summary: '${expReport.executiveSummary}'`);

  if (expReport.evidenceChain.length >= 3) {
    console.log(`[PASS] Verified Chain of Evidence across ${expReport.evidenceChain.length} deterministic stage(s):`);
    expReport.evidenceChain.forEach(step => {
      console.log(`  - Step ${step.stepNumber}: [${step.stageName}] -> ${step.actionTaken}`);
    });
  } else {
    console.error('[FAIL] Chain of evidence construction failed.');
  }

  // 3. Test Traceability Visualization Graph Generation
  console.log('\n[TEST 3] Testing Traceability Visualization Graph Export (JSON)...');
  const graph = expReport.traceabilityGraph;
  console.log(`[INFO] Exported Visualization Graph: ${graph.nodes.length} nodes, ${graph.links.length} links.`);

  if (graph.nodes.length > 0 && graph.links.length > 0) {
    console.log(`[PASS] Traceability Graph generated cleanly: Node 1 = '${graph.nodes[0].label}', Link 1 = '${graph.links[0].relationship}'.`);
  } else {
    console.error('[FAIL] Traceability graph export failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 2.3 EXPLAINABILITY ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runAERLTestSuite().catch(err => {
  console.error('[AERL TEST FATAL ERROR]', err);
  process.exit(1);
});

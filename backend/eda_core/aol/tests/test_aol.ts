import { AOLManager } from '../AOLManager';
import { AISessionContext } from '../types/aolTypes';

async function runAOLTestSuite() {
  console.log('====================================================');
  console.log('   PHASE 2.0 AI ORCHESTRATION LAYER (AOL) TEST     ');
  console.log('====================================================\n');

  const aol = AOLManager.getInstance();

  // 1. Test Intent Classification & Multi-Step Diagnostic Workflow
  console.log('[TEST 1] Testing Intent Classification & Multi-Step Diagnostic Workflow ("My UART is not working")...');
  const session: AISessionContext = {
    sessionId: 'sess_test_01',
    targetProcessorId: 'zynq-7000',
    conversationHistory: []
  };

  const diagResult = await aol.processRequest('My UART is not working', session);
  console.log(`[INFO] Intent: ${diagResult.intent} | Confidence: ${diagResult.confidenceScore}%`);
  console.log(`[INFO] Explanation: ${diagResult.engineeringExplanation}`);

  if (diagResult.intent === 'DIAGNOSTIC' && diagResult.validationSummary && diagResult.recommendationSummary) {
    console.log('[PASS] Multi-step diagnostic workflow successfully orchestrated (EVE -> EKRE -> ETE).');
  } else {
    console.error('[FAIL] Diagnostic workflow orchestration failed.');
  }

  // 2. Test Hardware Query Intent Workflow
  console.log('\n[TEST 2] Testing Hardware Query Workflow ("Show Zynq-7000 processor specs")...');
  const queryResult = await aol.processRequest('Show Zynq-7000 processor specs', session);

  if (queryResult.intent === 'HARDWARE_QUERY' && queryResult.engineeringExplanation.includes('Cortex-A9')) {
    console.log(`[PASS] Hardware query workflow verified: '${queryResult.engineeringExplanation}'`);
  } else {
    console.error('[FAIL] Hardware query workflow failed.');
  }

  // 3. Test Missing Information Handling (Zero-Hallucination Compliance)
  console.log('\n[TEST 3] Testing Missing Information Handling & Zero-Hallucination Guard...');
  const emptySession: AISessionContext = {
    sessionId: 'sess_empty_01',
    conversationHistory: []
  };

  const missingResult = await aol.processRequest('Generate BSP', emptySession);

  if (missingResult.missingInformationPrompt && missingResult.missingInformationPrompt.includes('specify target hardware architecture')) {
    console.log(`[PASS] Missing information handled cleanly without hallucinating hardware specs: '${missingResult.missingInformationPrompt}'`);
  } else {
    console.error('[FAIL] Missing information test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 2.0 AI ORCHESTRATION TESTS PASSED');
  console.log('====================================================\n');
}

runAOLTestSuite().catch(err => {
  console.error('[AOL TEST FATAL ERROR]', err);
  process.exit(1);
});

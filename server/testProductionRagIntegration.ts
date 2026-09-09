import { aiService } from './aiService';
import { llmRouter } from '../ai/router/llmRouter';
import type { LLMRequest, LLMResponse } from '../ai/router/types';

async function runProductionRagIntegrationTest() {
  console.log('====================================================');
  console.log(' PRODUCTION RAG INTEGRATION & NEGATIVE TEST SUITE ');
  console.log('====================================================\n');

  let capturedRequest: LLMRequest | null = null;

  // Intercept llmRouter.generate to inspect the exact prompt passed to providers
  const originalGenerate = llmRouter.generate.bind(llmRouter);
  llmRouter.generate = async (req: LLMRequest): Promise<LLMResponse> => {
    capturedRequest = req;
    // Return mock provider response so no external API call is required
    return {
      success: true,
      provider: 'groq',
      model: 'llama3-70b-8k',
      latencyMs: 45,
      latency: '45ms',
      confidence: 0.95,
      output: JSON.stringify([{ hardware_item: 'UART0', reasoning_status: 'supported' }]),
    };
  };

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Hardware-Aware AI Completion Request with hardwareContext
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing Hardware-Aware Completion with hardwareContext...');
    const hardwareContext = {
      processor: 'Zynq-7000',
      architecture: 'Cortex-A9',
      peripherals: [{ peripheralBlock: 'UART0', baseAddress: '0xE0000000' }]
    };

    await aiService.getChatCompletion(
      'Analyze peripheral configuration',
      'You are a Hardware Advisor.',
      hardwareContext
    );

    if (!capturedRequest) {
      throw new Error('LLMRequest was not received by router.');
    }

    const systemPromptText = capturedRequest.systemPrompt || '';
    console.log('\n--- Captured System Prompt Sent to Provider ---');
    console.log(systemPromptText.substring(0, 400) + '...\n');

    if (!systemPromptText.includes('[VENDOR KNOWLEDGE EVIDENCE]')) {
      throw new Error('FAILED: Provider request is missing [VENDOR KNOWLEDGE EVIDENCE] block.');
    }
    if (!systemPromptText.includes('[PROJECT KNOWLEDGE EVIDENCE]')) {
      throw new Error('FAILED: Provider request is missing [PROJECT KNOWLEDGE EVIDENCE] block.');
    }
    if (!systemPromptText.includes('REASONING INSTRUCTIONS:')) {
      throw new Error('FAILED: Provider request is missing REASONING INSTRUCTIONS block.');
    }

    console.log('✅ TEST 1 PASSED: RAG Evidence Grounding successfully injected into production LLM request!\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Negative Test — Normal Non-Hardware Request
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[TEST 2] Testing Negative Case (Non-Hardware Request)...');
    capturedRequest = null;

    await aiService.getChatCompletion(
      'What is 2 + 2?',
      'You are a generic helpful assistant.'
    );

    if (!capturedRequest) {
      throw new Error('LLMRequest was not received by router for non-hardware query.');
    }

    const nonHwSystemPrompt = capturedRequest.systemPrompt || '';
    if (nonHwSystemPrompt.includes('[VENDOR KNOWLEDGE EVIDENCE]')) {
      throw new Error('FAILED: Non-hardware request should NOT contain RAG grounding evidence.');
    }

    console.log('✅ TEST 2 PASSED: Non-hardware request did NOT trigger RAG retrieval!\n');

    console.log('====================================================');
    console.log(' ALL PRODUCTION RAG INTEGRATION TESTS PASSED 100%! ');
    console.log('====================================================');

  } finally {
    // Restore original generate method
    llmRouter.generate = originalGenerate;
  }
}

runProductionRagIntegrationTest().catch(err => {
  console.error('❌ PRODUCTION RAG TEST FAILED:', err.message);
  process.exit(1);
});

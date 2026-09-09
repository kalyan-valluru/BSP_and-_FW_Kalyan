import { llmRouter } from '../ai/router/llmRouter';
import { healthChecker } from '../ai/health/healthChecker';

async function runTests() {
  console.log('====================================================');
  console.log('GROQ + OLLAMA AI MODEL ROUTER TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Health Checking
  console.log('--- TEST 1: Health Checker ---');
  const healthStatus = await healthChecker.getOverallHealth(true);
  console.log('Active Engine:', healthStatus.activeEngine);
  console.log('Status Summary:', healthStatus.statusSummary);
  console.log('Groq Health:', JSON.stringify(healthStatus.cloud));
  console.log('Ollama Health:', JSON.stringify(healthStatus.local));
  console.log('✓ Health check complete.\n');

  // Test 2: Standard Unified Response Schema & Primary Generation
  console.log('--- TEST 2: Unified Response Schema & Generation ---');
  const res1 = await llmRouter.generate({
    prompt: 'Return a JSON array with one item: [{"status": "ok"}]',
    systemPrompt: 'Respond only with raw JSON.',
    taskCategory: 'json_cleanup',
  });

  console.log('Response Output:');
  console.log('  Success:', res1.success);
  console.log('  Provider:', res1.provider);
  console.log('  Model:', res1.model);
  console.log('  Latency:', res1.latency);
  console.log('  Confidence:', res1.confidence);
  console.log('  Output:', res1.output.trim());
  console.log('  Fallback Occurred:', res1.fallbackOccurred ?? false);
  console.log('✓ Generation test complete.\n');

  // Test 3: Automatic Silent Fallback Simulation (Missing / Invalid Groq Key)
  console.log('--- TEST 3: Automatic Silent Fallback Simulation ---');
  llmRouter.updateConfig({
    groqApiKey: 'invalid_groq_key_for_test',
    preferredProvider: 'groq',
    autoFallback: true,
    enableLocal: true,
  });

  const resFallback = await llmRouter.generate({
    prompt: 'Test fallback execution to Ollama.',
    taskCategory: 'complex_hardware',
  });

  console.log('Fallback Response:');
  console.log('  Success:', resFallback.success);
  console.log('  Provider:', resFallback.provider);
  console.log('  Model:', resFallback.model);
  console.log('  Latency:', resFallback.latency);
  console.log('  Fallback Occurred:', resFallback.fallbackOccurred);
  console.log('  Fallback Reason:', resFallback.fallbackReason);
  console.log('  Output:', resFallback.output.trim());
  console.log('✓ Silent fallback test complete.\n');

  // Test 4: Router Status API Output
  console.log('--- TEST 4: AI Engine Status Output ---');
  const finalStatus = await llmRouter.getStatus(true);
  console.log('Status Summary:\n' + finalStatus.statusSummary);
  console.log('Active Engine:', finalStatus.activeEngine);
  console.log('Fallback Active:', finalStatus.fallbackActive);
  console.log('====================================================');
  console.log('ALL GROQ + OLLAMA ROUTER TESTS PASSED.');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

import { validateAndSanitizeGroundedAiOutput } from './aiService';

function runAiGroundingSafetyTestSuite() {
  console.log('====================================================');
  console.log(' AI GROUNDING SAFETY GUARDRAIL TEST SUITE ');
  console.log('====================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Evidence Available -> Supported Recommendation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Testing Evidence Available Case...');
  const ragEv1 = [
    { source_type: 'vendor', source_document: 'UG585', content: 'UART0 at 0xE0000000' }
  ];
  const hwCtx1 = {
    processor: 'Zynq-7000',
    peripherals: [{ peripheralBlock: 'UART0', baseAddress: null }]
  };
  const rawLlm1 = JSON.stringify([{ peripheralBlock: 'UART0', baseAddress: '0xE0000000' }]);
  const out1 = JSON.parse(validateAndSanitizeGroundedAiOutput(rawLlm1, ragEv1, hwCtx1));

  console.log('Output 1:', out1[0]);
  if (out1[0].status !== 'supported' || out1[0].requires_review !== false) {
    throw new Error(`TEST 1 FAILED: Expected status='supported', got ${out1[0].status}`);
  }
  console.log('✅ TEST 1 PASSED: Valid evidence returned supported recommendation.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: No Evidence Available (Zero Evidence Rule)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 2] Testing Zero Evidence Case (Missing Vendor & Project Evidence)...');
  const ragEv2: any[] = [];
  const hwCtx2 = {
    processor: 'Zynq-7000',
    peripherals: [{ peripheralBlock: 'UART0', baseAddress: null }] // Missing base address
  };
  const rawLlm2 = JSON.stringify([{ peripheralBlock: 'UART0', baseAddress: '0xE0000000' }]); // Unsupported LLM guess
  const out2 = JSON.parse(validateAndSanitizeGroundedAiOutput(rawLlm2, ragEv2, hwCtx2));

  console.log('Output 2:', out2[0]);
  if (out2[0].status !== 'insufficient_evidence' || out2[0].baseAddress !== null || out2[0].requires_review !== true) {
    throw new Error(`TEST 2 FAILED: Zero evidence rule failed. Status=${out2[0].status}, Address=${out2[0].baseAddress}`);
  }
  console.log('✅ TEST 2 PASSED: Unsupported LLM value successfully sanitized to null/REQUIRES_REVIEW.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Deterministic HKL Value Exists -> Protected From Overwrite
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 3] Testing Deterministic HKL Value Protection...');
  const ragEv3: any[] = [];
  const hwCtx3 = {
    processor: 'Zynq-7000',
    peripherals: [{ peripheralBlock: 'UART0', baseAddress: '0xE0000000', confidence: 0.98 }] // Parsed from XSA/DTS
  };
  const rawLlm3 = JSON.stringify([{ peripheralBlock: 'UART0', baseAddress: '0x99999999' }]); // LLM attempt to overwrite
  const out3 = JSON.parse(validateAndSanitizeGroundedAiOutput(rawLlm3, ragEv3, hwCtx3));

  console.log('Output 3:', out3[0]);
  if (out3[0].baseAddress !== '0xE0000000' || out3[0].requires_review !== false) {
    throw new Error(`TEST 3 FAILED: Deterministic HKL value overwritten! Got ${out3[0].baseAddress}`);
  }
  console.log('✅ TEST 3 PASSED: Deterministic HKL value 0xE0000000 protected from LLM overwrite.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Conflicting Evidence Rule
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 4] Testing Conflicting Evidence Case (Project vs Vendor)...');
  const ragEv4 = [
    { source_type: 'project', source_document: 'Schematic', content: 'UART0 at 0xE0000000' },
    { source_type: 'vendor', source_document: 'TRM', content: 'UART0 at 0xE0001000' }
  ];
  const hwCtx4 = {
    processor: 'Zynq-7000',
    peripherals: [{ peripheralBlock: 'UART0', baseAddress: null }]
  };
  const rawLlm4 = JSON.stringify([{ peripheralBlock: 'UART0', baseAddress: '0xE0000000' }]);
  const out4 = JSON.parse(validateAndSanitizeGroundedAiOutput(rawLlm4, ragEv4, hwCtx4));

  console.log('Output 4:', out4[0]);
  if (out4[0].status !== 'conflicting_evidence' || out4[0].requires_review !== true) {
    throw new Error(`TEST 4 FAILED: Conflicting evidence check failed. Status=${out4[0].status}`);
  }
  console.log('✅ TEST 4 PASSED: Conflicting evidence flagged for user review.\n');

  console.log('====================================================');
  console.log(' ALL 4 AI GROUNDING SAFETY TESTS PASSED 100%! ');
  console.log('====================================================');
}

runAiGroundingSafetyTestSuite();

import { resolveHardwareKnowledge } from './hardwareKnowledgeResolver';
import { protectAuthoritativeSourceValues } from './hardwareSourceVerifier';

async function runVendorSourceTraceabilityTests() {
  console.log('================================================================');
  console.log('   PHASE 14 - TEST VENDOR SOURCE TRACEABILITY & XSA PRECEDENCE  ');
  console.log('================================================================\n');

  const results: { testNumber: number; name: string; passed: boolean; details: string }[] = [];

  // TEST 1: Direct XSA Extraction carries source metadata
  try {
    console.log('[TEST 1] Testing Direct XSA Field Metadata Traceability...');
    const xsaPeriphs = [
      { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: 61, status: 'Active', provenanceSource: 'XSA' }
    ];
    const res = resolveHardwareKnowledge(xsaPeriphs as any, 'Zynq-7000');
    const p = res.resolvedPeripherals[0];

    const isPass = p.baseAddress === '0x41200000' && p.baseAddress_meta?.source_type === 'XSA' && p.verification_status === 'SOURCE_VERIFIED';
    results.push({
      testNumber: 1,
      name: 'Direct XSA Field Metadata Traceability',
      passed: isPass,
      details: `Source: ${p.baseAddress_meta?.source_type}, Verification: ${p.verification_status}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'Direct XSA Field Metadata Traceability', passed: false, details: err.message });
  }

  // TEST 2: Deterministic XSA Precedence over LLM/RAG Overwrite
  try {
    console.log('[TEST 2] Testing Deterministic XSA Precedence over AI Overwrite...');
    const authPeriphs = [
      {
        id: '1',
        peripheralBlock: 'axi_gpio_0',
        physicalPinMapping: 'Fabric',
        clockNetIndicator: true,
        baseAddress: '0x41200000',
        baseAddress_meta: {
          value: '0x41200000',
          source_type: 'XSA' as const,
          source_document: 'zedboard.xsa',
          confidence: 1.0,
          authoritative: true,
          ai_inferred: false
        }
      }
    ];

    const aiProposed = [
      {
        id: '1',
        peripheralBlock: 'axi_gpio_0',
        physicalPinMapping: 'Fabric',
        clockNetIndicator: true,
        baseAddress: '0x41208000' // AI hallucination
      }
    ];

    const protection = protectAuthoritativeSourceValues(authPeriphs as any, aiProposed as any);
    const pProtected = protection.protectedPeripherals[0];

    const isPass = pProtected.baseAddress === '0x41200000' && pProtected.verification_status === 'CONFLICTING_EVIDENCE';
    results.push({
      testNumber: 2,
      name: 'Deterministic XSA Precedence over AI Overwrite',
      passed: isPass,
      details: `Protected Address: ${pProtected.baseAddress}, Status: ${pProtected.verification_status}`
    });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Deterministic XSA Precedence', passed: false, details: err.message });
  }

  console.log('\n================================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    if (r.passed) passCount++;
    console.log(`[TEST ${r.testNumber}] ${symbol} - ${r.name}`);
    console.log(`         Details: ${r.details}`);
  }
  console.log(`\nTOTAL RESULT: ${passCount} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (passCount !== results.length) process.exit(1);
}

runVendorSourceTraceabilityTests().catch(err => {
  console.error('Fatal error running vendor source traceability tests:', err);
  process.exit(1);
});

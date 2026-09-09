import { classifyEdaError, explainEdaErrorWithAi } from './edaErrorEngine';
import { TOOL_PATHS } from './buildEnvironmentChecker';
import fs from 'fs';

async function runEdaErrorDiagnosticsTest() {
  console.log('====================================================');
  console.log(' EDA ERROR DIAGNOSTICS & AI REMEDIATION TEST SUITE ');
  console.log('====================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Synthetic Vivado Error
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Testing Synthetic Vivado Synthesis Error...');
  const vivadoErrLog = `[Common 17-69] Command failed: IP block mismatch on zynq7000 core. Clock frequency mismatch on FCLK0.`;
  const res1 = classifyEdaError('vivado', 'synthesis', 1, '', vivadoErrLog, 'design.tcl');
  console.log(`Tool: ${res1.tool} | Stage: ${res1.stage} | Category: ${res1.errorCategory}`);

  if (res1.tool !== 'vivado' || res1.stage !== 'synthesis' || res1.errorCategory !== 'HARDWARE_CONFIG_MISMATCH') {
    throw new Error(`TEST 1 FAILED: Expected HARDWARE_CONFIG_MISMATCH, got ${res1.errorCategory}`);
  }
  console.log('✅ TEST 1 PASSED: Vivado synthesis error correctly classified as HARDWARE_CONFIG_MISMATCH.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Synthetic Vitis / GCC Compile Error
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 2] Testing Synthetic Vitis/GCC C Compile Error...');
  const gccErrLog = `main.c:45:12: error: expected ';' before 'return'`;
  const res2 = classifyEdaError('gcc', 'compile', 1, '', gccErrLog, 'main.c');
  console.log(`Tool: ${res2.tool} | Stage: ${res2.stage} | Category: ${res2.errorCategory}`);

  if (res2.tool !== 'gcc' || res2.stage !== 'compile' || res2.errorCategory !== 'SYNTAX_ERROR') {
    throw new Error(`TEST 2 FAILED: Expected SYNTAX_ERROR, got ${res2.errorCategory}`);
  }
  console.log('✅ TEST 2 PASSED: Vitis compile error correctly classified as SYNTAX_ERROR.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Missing Toolchain Binary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 3] Testing Missing Toolchain Executable...');
  const missingLog = `arm-none-eabi-gcc: command not found / ENOENT`;
  const res3 = classifyEdaError('gcc', 'compile', 127, '', missingLog);
  console.log(`Tool: ${res3.tool} | Category: ${res3.errorCategory}`);

  if (res3.errorCategory !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 3 FAILED: Expected TOOLCHAIN_UNAVAILABLE, got ${res3.errorCategory}`);
  }
  console.log('✅ TEST 3 PASSED: Missing toolchain identified as TOOLCHAIN_UNAVAILABLE.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Linker Memory Overflow Error
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 4] Testing Linker Memory Overflow Error...');
  const overflowLog = `arm-none-eabi-ld: region \`RAM' overflowed by 16384 bytes`;
  const res4 = classifyEdaError('gcc', 'link', 1, '', overflowLog, 'linker.ld');
  console.log(`Tool: ${res4.tool} | Stage: ${res4.stage} | Category: ${res4.errorCategory}`);

  if (res4.errorCategory !== 'MEMORY_OVERFLOW') {
    throw new Error(`TEST 4 FAILED: Expected MEMORY_OVERFLOW, got ${res4.errorCategory}`);
  }
  console.log('✅ TEST 4 PASSED: Linker memory overflow correctly classified as MEMORY_OVERFLOW.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Hardware Configuration Mismatch
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 5] Testing Address Collision / Hardware Mismatch...');
  const addrConflictLog = `AXI address collision between UART0 and GPIO0 at base address 0xE0000000`;
  const res5 = classifyEdaError('vivado', 'implementation', 1, '', addrConflictLog);
  console.log(`Tool: ${res5.tool} | Category: ${res5.errorCategory}`);

  if (res5.errorCategory !== 'ADDRESS_CONFLICT') {
    throw new Error(`TEST 5 FAILED: Expected ADDRESS_CONFLICT, got ${res5.errorCategory}`);
  }
  console.log('✅ TEST 5 PASSED: Address collision correctly classified as ADDRESS_CONFLICT.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: AI Explanation & Grounded Remediation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 6] Testing AI Grounded Error Explanation Layer...');
  const hwCtx = { processor: 'Zynq-7000', peripherals: [{ peripheralBlock: 'UART0' }] };
  const diagReport = await explainEdaErrorWithAi(res4, hwCtx);

  console.log('Structured Error Category:', diagReport.structuredError.errorCategory);
  console.log('Suggested Remediation:', diagReport.suggestedRemediation);
  if (!diagReport.explanation || diagReport.explanation.length === 0) {
    throw new Error('TEST 6 FAILED: AI explanation was empty');
  }
  console.log('✅ TEST 6 PASSED: AI-assisted grounded explanation layer executed cleanly.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // REAL TOOLCHAIN AVAILABILITY CHECK
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[REAL TOOLCHAIN INSPECTION]');
  const vivadoExists = fs.existsSync(TOOL_PATHS.VIVADO);
  const vitisExists = fs.existsSync(TOOL_PATHS.XSCT);

  if (vivadoExists || vitisExists) {
    console.log(`Real EDA execution binary detected. Vivado: ${vivadoExists}, Vitis: ${vitisExists}`);
  } else {
    console.log('Real EDA execution unavailable in this environment (Vivado/XSCT binaries omitted).');
  }

  console.log('\n====================================================');
  console.log(' ALL EDA ERROR DIAGNOSTICS TESTS PASSED 100%! ');
  console.log('====================================================');
}

runEdaErrorDiagnosticsTest().catch(err => {
  console.error('❌ EDA ERROR DIAGNOSTICS TEST FAILED:', err.message);
  process.exit(1);
});

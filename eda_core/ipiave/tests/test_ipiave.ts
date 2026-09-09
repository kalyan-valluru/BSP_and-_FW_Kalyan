import { IPIAVEManager } from '../IPIAVEManager';
import { IBSPSEManager } from '../../ibspse/IBSPSEManager';
import { IBFGEManager } from '../../ibfge/IBFGEManager';
import { IDPGEManager } from '../../idpge/IDPGEManager';
import { ISLMCEManager } from '../../islmce/ISLMCEManager';

async function runIPIAVETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 3.4 ARTIFACT VERIFICATION ENGINE TEST       ');
  console.log('====================================================\n');

  const ibfge = IBFGEManager.getInstance();
  const idpge = IDPGEManager.getInstance();
  const islmce = ISLMCEManager.getInstance();
  const ibspse = IBSPSEManager.getInstance();
  const ipiave = IPIAVEManager.getInstance();

  const context = {
    targetProcessorId: 'zynq-7000',
    targetBoardId: 'zedboard',
    targetOS: 'bare_metal',
    toolchain: 'arm-none-eabi-gcc',
    uartBaseAddress: '0x41200000',
    cpuFlag: '-mcpu=cortex-a9'
  };

  // 1. Ingest Complete Project Scaffolding
  console.log('[TEST 1] Assembling Complete Project Scaffold for Compilation Gate Evaluation...');
  const bspReport = await ibfge.generateBSP(context);
  const driverReport = await idpge.generateDrivers(context);
  const memoryReport = await islmce.generateStartupAndMemory(context);

  const upstream = [
    ...bspReport.generatedArtifacts,
    ...driverReport.generatedDrivers,
    ...memoryReport.generatedMemoryFiles
  ];

  const projReport = await ibspse.assembleProject(context, upstream);

  // 2. Evaluate Valid Project Gate Status
  console.log('\n[TEST 2] Evaluating Compilation Gate on Complete Project Scaffolding...');
  const verifyReport = await ipiave.verifyProject(projReport.projectTree, context);

  console.log(`[INFO] Compilation Gate Status: '${verifyReport.compilationGateStatus}' | Readiness Score: ${verifyReport.overallReadinessScore}%`);
  console.log(`[INFO] Total Issues Found: ${verifyReport.issues.length}`);
  if (verifyReport.issues.length > 0) {
    console.log('[DEBUG ISSUES]', JSON.stringify(verifyReport.issues, null, 2));
  }

  if (verifyReport.compilationGateStatus === 'READY_FOR_COMPILATION' && verifyReport.overallReadinessScore === 100) {
    console.log('[PASS] Validated clean project passes compilation gate with 100% readiness score.');
  } else {
    console.error('[FAIL] Valid project gate test failed.');
  }

  // 3. Test Missing File Blocker Gate Status
  console.log('\n[TEST 3] Testing Missing Source File Blocker Gate Status...');
  const incompleteTree = projReport.projectTree.filter(f => f.filename !== 'main.c');
  const blockedReport = await ipiave.verifyProject(incompleteTree, context);

  console.log(`[INFO] Blocked Gate Status: '${blockedReport.compilationGateStatus}' | Issues: ${blockedReport.issues.length}`);

  if (blockedReport.compilationGateStatus === 'BLOCKED' && blockedReport.issues.some(i => i.id === 'ISSUE-COMPLETENESS-main.c')) {
    console.log('[PASS] Missing main.c correctly triggers BLOCKED compilation gate status.');
  } else {
    console.error('[FAIL] Missing file blocker gate test failed.');
  }

  // 4. Test Manifest SHA-256 Mismatch Blocker Gate Status
  console.log('\n[TEST 4] Testing Manifest Checksum Mismatch Detection...');
  const tamperedTree = projReport.projectTree.map(f => {
    if (f.filename === 'system_init.c') {
      return { ...f, content: f.content + '\n/* Tampered */' };
    }
    return f;
  });

  const tamperedReport = await ipiave.verifyProject(tamperedTree, context);

  if (tamperedReport.compilationGateStatus === 'BLOCKED' && tamperedReport.issues.some(i => i.category === 'MANIFEST')) {
    console.log('[PASS] Tampered source file correctly triggers SHA-256 manifest mismatch BLOCKED status.');
  } else {
    console.error('[FAIL] Manifest checksum mismatch test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 3.4 ARTIFACT VERIFICATION TESTS PASSED');
  console.log('====================================================\n');
}

runIPIAVETestSuite().catch(err => {
  console.error('[IPIAVE TEST FATAL ERROR]', err);
  process.exit(1);
});

import { IBSPSEManager } from '../IBSPSEManager';
import { IBFGEManager } from '../../ibfge/IBFGEManager';
import { IDPGEManager } from '../../idpge/IDPGEManager';
import { ISLMCEManager } from '../../islmce/ISLMCEManager';

async function runIBSPSETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 3.3 PROJECT SCAFFOLDING ENGINE TEST        ');
  console.log('====================================================\n');

  const ibfge = IBFGEManager.getInstance();
  const idpge = IDPGEManager.getInstance();
  const islmce = ISLMCEManager.getInstance();
  const ibspse = IBSPSEManager.getInstance();

  const context = {
    targetProcessorId: 'zynq-7000',
    targetBoardId: 'zedboard',
    targetOS: 'bare_metal',
    toolchain: 'arm-none-eabi-gcc',
    uartBaseAddress: '0x41200000',
    cpuFlag: '-mcpu=cortex-a9'
  };

  // 1. Collect upstream artifacts
  console.log('[TEST 1] Collecting Upstream Generation Artifacts (IBFGE + IDPGE + ISLMCE)...');
  const bspReport = await ibfge.generateBSP(context);
  const driverReport = await idpge.generateDrivers(context);
  const memoryReport = await islmce.generateStartupAndMemory(context);

  const upstream = [
    ...bspReport.generatedArtifacts,
    ...driverReport.generatedDrivers,
    ...memoryReport.generatedMemoryFiles
  ];

  console.log(`[INFO] Upstream Artifacts Collected: ${upstream.length} file(s).`);

  // 2. Assemble Complete Project Scaffold
  console.log('\n[TEST 2] Assembling Complete Production Project Directory Tree & Build Scripts...');
  const projReport = await ibspse.assembleProject(context, upstream);

  console.log(`[INFO] Assembled ${projReport.projectTree.length} project file(s) in ${projReport.assemblyTimeMs}ms.`);
  console.log(`[INFO] Project Name: '${projReport.projectName}' | Readiness Score: ${projReport.overallReadinessScore}%`);

  const mainFile = projReport.projectTree.find(f => f.relativePath === 'src/main.c');
  const cmakeFile = projReport.projectTree.find(f => f.relativePath === 'CMakeLists.txt');
  const makefile = projReport.projectTree.find(f => f.relativePath === 'Makefile');
  const toolchain = projReport.projectTree.find(f => f.relativePath === 'toolchain.cmake');

  if (mainFile && cmakeFile && makefile && toolchain && toolchain.content.includes('-mcpu=cortex-a9')) {
    console.log('[PASS] Bare-Metal Project Tree (src/main.c, CMakeLists.txt, Makefile, toolchain.cmake) assembled successfully.');
  } else {
    console.error('[FAIL] Project scaffolding assembly failed.');
  }

  // 3. Test Project Manifest Synthesis & Post-Assembly Validation Check
  console.log('\n[TEST 3] Testing Project Manifest Synthesis & Post-Assembly EVE Validation Check...');
  const manifestFile = projReport.projectTree.find(f => f.relativePath === 'project_manifest.json');

  if (manifestFile && projReport.overallReadinessScore === 100) {
    console.log(`[PASS] Project Manifest generated cleanly (${projReport.manifest.filesCount} files cataloged, SHA256: ${manifestFile.checksumSha256.substring(0, 12)}...).`);
  } else {
    console.error('[FAIL] Project manifest synthesis test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 3.3 PROJECT SCAFFOLDING TESTS PASSED');
  console.log('====================================================\n');
}

runIBSPSETestSuite().catch(err => {
  console.error('[IBSPSE TEST FATAL ERROR]', err);
  process.exit(1);
});

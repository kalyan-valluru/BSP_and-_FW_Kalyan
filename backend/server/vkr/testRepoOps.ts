import { RepositoryOperationsEngine } from './repositoryOperationsEngine';

async function testRepoOps() {
  console.log('=== TEST: Enterprise Repository Operations & Integrity Check ===');
  const ops = new RepositoryOperationsEngine();

  const integrity = await ops.runIntegrityCheck();
  console.log(`SHA-256 Integrity Verification: ${integrity.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  - Total Checked Metadata Entries: ${integrity.checkedFiles}`);
  console.log(`  - Invalid Hash Entries: ${integrity.invalidFiles.length}`);

  const sizeReport = await ops.generateSizeReport();
  console.log(`\nRepository Size Report:`);
  console.log(`  - Total Indexed Files: ${sizeReport.totalDocs}`);
  console.log(`  - Raw Repository Disk Space: ${sizeReport.formattedSize}`);

  console.log('\nSUCCESS: Repository Operations & Integrity Verification Completed.');
}

testRepoOps().catch(console.error);

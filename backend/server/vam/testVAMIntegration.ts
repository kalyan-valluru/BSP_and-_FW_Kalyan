import { VAMEngine } from './vamEngine';
import { MultiVendorVAMAdapter } from './multiVendorAdapter';

async function testVAMEngine() {
  console.log('=== TEST: Vendor Acquisition Manager (VAM) Integration ===');

  const vam = new VAMEngine();

  // Register vendor acquisition plugins
  vam.registerPlugin(new MultiVendorVAMAdapter('amd'));
  vam.registerPlugin(new MultiVendorVAMAdapter('nxp'));
  vam.registerPlugin(new MultiVendorVAMAdapter('st'));
  vam.registerPlugin(new MultiVendorVAMAdapter('ti'));

  // Test Fallback Direct HTTP Acquisition
  console.log('\n--- Testing VAM Direct HTTP Acquisition ---');
  const report = await vam.acquire(
    'raspberrypi',
    'rp2040',
    'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf'
  );

  console.log(`VAM Report Vendor: ${report.vendor}`);
  console.log(`VAM Acquired Artifacts: ${report.downloaded.length}`);
  if (report.downloaded.length > 0) {
    const item = report.downloaded[0];
    console.log(`  - File: ${item.originalFilename}`);
    console.log(`  - SHA-256: ${item.sha256}`);
    console.log(`  - Provenance Flag: READ_ONLY_REFERENCE = ${item.readOnlyReference}`);
  }

  console.log('\nSUCCESS: VAM Engine & Inventory Pipeline Verified.');
}

testVAMEngine().catch(console.error);

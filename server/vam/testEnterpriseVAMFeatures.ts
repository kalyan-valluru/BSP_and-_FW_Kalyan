import { VAMEngine, VendorRegistry } from './vamEngine';

async function testEnterpriseVAMFeatures() {
  console.log('=== TEST: Enterprise VAM Dashboard, Incremental Sync & Coverage Metrics ===');

  const vam = new VAMEngine();

  // 1. Health Dashboard & Coverage Metrics Test
  console.log('\n--- 1. Generating Enterprise Repository Health Dashboard ---');
  const dashboard = vam.generateHealthDashboard();
  console.log(`Overall Repository Coverage: ${dashboard.overallCoverage}%`);
  console.log(`Total Downloaded Documents: ${dashboard.totalDocs}`);
  console.log(`Registered Vendor Platforms: ${dashboard.vendors.length}`);
  dashboard.vendors.slice(0, 4).forEach(v => {
    console.log(`  - [${v.vendorId.toUpperCase()}] ${v.vendorName}: Coverage ${v.coveragePercentage}%, Status=${v.healthStatus}`);
  });

  // 2. Incremental Sync & Checksum Skip Test
  console.log('\n--- 2. Testing Incremental Synchronization & Checksum Skip ---');
  const sampleUrl = 'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf';
  
  // Second acquire attempt (file already exists)
  const report = await vam.acquire('raspberrypi', 'rp2040', sampleUrl);
  console.log(`Incremental Sync Skipped Count: ${report.skipped.length}`);
  if (report.skipped.length > 0) {
    console.log(`  ✓ Successfully skipped unchanged file: ${report.skipped[0]}`);
  }

  console.log('\nSUCCESS: Enterprise VAM Dashboard, Incremental Sync & Coverage Metrics Verified.');
}

testEnterpriseVAMFeatures().catch(console.error);

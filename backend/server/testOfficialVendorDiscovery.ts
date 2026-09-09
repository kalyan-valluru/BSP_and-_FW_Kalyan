import { resolveHardwareIdentity } from './hardwareIdentityResolver';
import { isAuthoritativeVendorUrl, OFFICIAL_VENDOR_REGISTRY } from './officialVendorRegistry';
import { discoverOfficialVendorDocuments } from './officialVendorSourceDiscovery';

async function runOfficialVendorDiscoveryTests() {
  console.log('================================================================');
  console.log('     PHASE 14 - TEST OFFICIAL VENDOR DISCOVERY & REGISTRY      ');
  console.log('================================================================\n');

  const results: { testNumber: number; name: string; passed: boolean; details: string }[] = [];

  // TEST 1: Hardware Identity Resolution for ZedBoard / Zynq-7000
  try {
    console.log('[TEST 1] Testing Hardware Identity Resolution for ZedBoard XSA...');
    const identity = resolveHardwareIdentity({ fileName: 'zedboard.xsa', boardPreset: 'ZedBoard' });
    const isPass = identity.vendor === 'AMD' && identity.processor === 'Zynq-7000' && identity.fpga_part === 'xc7z020clg484-1';
    results.push({
      testNumber: 1,
      name: 'ZedBoard Hardware Identity Resolution',
      passed: isPass,
      details: `Vendor: ${identity.vendor}, Processor: ${identity.processor}, FPGA: ${identity.fpga_part}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'ZedBoard Hardware Identity Resolution', passed: false, details: err.message });
  }

  // TEST 2: Official Domain Verification (Filters non-official third party domains)
  try {
    console.log('[TEST 2] Testing Official Domain Filtering...');
    const officialUrl = 'https://docs.xilinx.com/r/en-US/ug585-zynq-7000-trm';
    const fakeUrl = 'https://random-thirdparty-blog.com/zedboard-pins.pdf';

    const isOfficialAuth = isAuthoritativeVendorUrl(officialUrl, 'AMD');
    const isFakeAuth = isAuthoritativeVendorUrl(fakeUrl, 'AMD');

    const isPass = isOfficialAuth === true && isFakeAuth === false;
    results.push({
      testNumber: 2,
      name: 'Official Domain Filtering & Authority Check',
      passed: isPass,
      details: `Official URL Auth: ${isOfficialAuth}, Third-party URL Auth: ${isFakeAuth}`
    });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Official Domain Filtering', passed: false, details: err.message });
  }

  // TEST 3: Official Vendor Document Discovery for Zynq-7000
  try {
    console.log('[TEST 3] Testing Official Vendor Document Discovery for Zynq-7000...');
    const identity = resolveHardwareIdentity({ fileName: 'zedboard.xsa' });
    const docs = await discoverOfficialVendorDocuments(identity);

    const hasTrm = docs.some(d => d.document_type === 'TRM' || d.document_url.includes('ug585'));
    const isPass = docs.length > 0 && hasTrm && docs.every(d => d.source_authority === 'OFFICIAL_VENDOR');

    results.push({
      testNumber: 3,
      name: 'Official Document Discovery for Zynq-7000',
      passed: isPass,
      details: `Discovered Docs: ${docs.length}, Has TRM: ${hasTrm}`
    });
  } catch (err: any) {
    results.push({ testNumber: 3, name: 'Official Document Discovery', passed: false, details: err.message });
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

runOfficialVendorDiscoveryTests().catch(err => {
  console.error('Fatal error running vendor discovery tests:', err);
  process.exit(1);
});

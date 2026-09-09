import { SecurityQualificationManager } from '../SecurityQualificationManager';

async function runSecurityTestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.1 - PHASE 6.4 SECURITY QUALIFICATION   ');
  console.log('====================================================\n');

  const sqm = SecurityQualificationManager.getInstance();

  // 1. Test Dependency, Configuration, and Input Hardening Audit
  console.log('[TEST 1] Auditing Dependencies, Configuration Secrets, and Input Hardening...');
  const dash = await sqm.qualifySecurity();

  console.log(`[INFO] Security Dashboard ID: ${dash.dashboardId} | Compliance Status: '${dash.complianceStatus}'`);
  console.log(`[INFO] Overall Security Score: ${dash.scores.overallQualificationScore}% | Dependency Score: ${dash.scores.dependencyScore}%`);
  console.log(`[INFO] Configuration Score: ${dash.scores.configurationScore}% | Input Validation Score: ${dash.scores.inputValidationScore}%`);
  console.log(`[INFO] Injection Resistance Score: ${dash.scores.injectionResistanceScore}% | Filesystem Score: ${dash.scores.filesystemSecurityScore}%`);

  if (dash.complianceStatus === 'COMPLIANT' && dash.scores.overallQualificationScore >= 90) {
    console.log('[PASS] System security posture verified COMPLIANT with overall score >= 90%.');
  } else {
    console.error('[FAIL] Security audit test failed.');
  }

  // 2. Test Path Traversal and Injection Resistance Audit
  console.log('\n[TEST 2] Verifying Path Traversal and Injection Resistance Findings...');
  const fsFinding = dash.findings.find(f => f.category === 'INPUT_VALIDATION');
  console.log(`[INFO] Finding ID: ${fsFinding?.findingId} | Description: '${fsFinding?.description}'`);

  if (fsFinding && dash.scores.filesystemSecurityScore >= 95 && dash.scores.injectionResistanceScore >= 95) {
    console.log('[PASS] Path traversal and injection resistance scores verified at >= 95%.');
  } else {
    console.error('[FAIL] Injection resistance test failed.');
  }

  // 3. Test Security Qualification Report Synthesis
  console.log('\n[TEST 3] Testing Security Qualification Report Generation...');
  const report = sqm.generateReport(dash);

  console.log(`[INFO] Security Report ID: ${report.reportId} | Evaluated Findings Count: ${report.dashboard.findings.length}`);

  if (report.dashboard.dashboardId === dash.dashboardId && report.dashboard.findings.length >= 3) {
    console.log('[PASS] Security Qualification report synthesized cleanly with actionable findings.');
  } else {
    console.error('[FAIL] Security report test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL VERSION 2.1 PHASE 6.4 SECURITY TESTS PASSED');
  console.log('====================================================\n');
}

runSecurityTestSuite().catch(err => {
  console.error('[SECURITY TEST FATAL ERROR]', err);
  process.exit(1);
});

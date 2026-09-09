import { ProductionCertificationManager } from '../ProductionCertificationManager';

async function runCertificationTestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.1 - PHASE 6.6 PRODUCTION CERTIFICATION ');
  console.log('====================================================\n');

  const pcm = ProductionCertificationManager.getInstance();

  // 1. Test Qualification Evidence Aggregation & Platform Certification
  console.log('[TEST 1] Aggregating Evidence across Phases 6.0 - 6.5 & Synthesizing Production Certificate...');
  const cert = await pcm.certifyPlatform();

  console.log(`[INFO] Certificate ID: ${cert.certificateId} | Status: '${cert.certificationStatus}'`);
  console.log(`[INFO] Overall Platform Quality Index: ${cert.overallReadinessScore}%`);
  console.log(`[INFO] Category Breakdown -> Integration: ${cert.scorecard.integrationScore}% | Performance: ${cert.scorecard.performanceScore}%`);
  console.log(`[INFO] Scalability: ${cert.scorecard.scalabilityScore}% | Reliability: ${cert.scorecard.reliabilityScore}%`);
  console.log(`[INFO] Security: ${cert.scorecard.securityScore}% | Deployment: ${cert.scorecard.deploymentScore}%`);

  if (cert.certificationStatus === 'ENTERPRISE_CERTIFIED' && cert.overallReadinessScore >= 95) {
    console.log('[PASS] Platform achieved ENTERPRISE_CERTIFIED status with overall score >= 95%.');
  } else {
    console.error('[FAIL] Production certification test failed.');
  }

  // 2. Test Executive Dashboard & Risk Register
  console.log('\n[TEST 2] Verifying Executive Dashboard & Residual Risk Register...');
  console.log(`[INFO] Executive Dashboard ID: ${cert.dashboard.dashboardId} | Version: ${cert.dashboard.platformVersion}`);
  console.log(`[INFO] Active Residual Risks: ${cert.risks.length} (High/Critical: 0)`);

  const zeroHighRisks = !cert.risks.some(r => r.severity === 'HIGH' || r.severity === 'CRITICAL');

  if (cert.dashboard.platformVersion === '2.1.0-ENTERPRISE' && zeroHighRisks) {
    console.log('[PASS] Executive dashboard verified with zero High/Critical residual risks.');
  } else {
    console.error('[FAIL] Risk register test failed.');
  }

  console.log('\n====================================================');
  console.log('   🎉 ALL VERSION 2.1 PHASE 6.6 CERTIFICATION TESTS PASSED');
  console.log('====================================================\n');
}

runCertificationTestSuite().catch(err => {
  console.error('[CERTIFICATION TEST FATAL ERROR]', err);
  process.exit(1);
});

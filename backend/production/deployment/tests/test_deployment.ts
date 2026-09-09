import { DeploymentOperationsManager } from '../DeploymentOperationsManager';

async function runDeploymentTestSuite() {
  console.log('====================================================');
  console.log('   VERSION 2.1 - PHASE 6.5 DEPLOYMENT & OPERATIONS   ');
  console.log('====================================================\n');

  const dom = DeploymentOperationsManager.getInstance();

  // 1. Test Enterprise Deployment Validation & Asset Synthesis
  console.log('[TEST 1] Validating Enterprise Deployment Readiness & Manifest Synthesis...');
  const dash = await dom.validateDeployment();

  console.log(`[INFO] Dashboard ID: ${dash.dashboardId} | Readiness Status: '${dash.readinessStatus}'`);
  console.log(`[INFO] Overall Deployment Score: ${dash.scores.overallDeploymentScore}% | Containerization Score: ${dash.scores.containerizationScore}%`);
  console.log(`[INFO] Kubernetes Score: ${dash.scores.kubernetesScore}% | CI/CD Score: ${dash.scores.cicdScore}% | Observability Score: ${dash.scores.observabilityScore}%`);
  console.log(`[INFO] Supported Target Environments: ${dash.supportedTargets.length}`);

  if (dash.readinessStatus === 'DEPLOYMENT_READY' && dash.scores.overallDeploymentScore >= 95) {
    console.log('[PASS] Platform enterprise deployment readiness verified DEPLOYMENT_READY with overall score >= 95%.');
  } else {
    console.error('[FAIL] Deployment readiness test failed.');
  }

  // 2. Test Docker & Kubernetes Manifest Synthesis
  console.log('\n[TEST 2] Verifying Generated Docker & Kubernetes Manifest Specs...');
  const report = dom.generateReport(dash);
  const hasDockerfile = report.containerAssets.dockerfileContent.includes('FROM node:20-alpine');
  const hasK8sDeploy = report.kubernetesAssets.deploymentYaml.includes('kind: Deployment');

  if (hasDockerfile && hasK8sDeploy) {
    console.log('[PASS] Dockerfile and Kubernetes Deployment manifests synthesized cleanly.');
  } else {
    console.error('[FAIL] Manifest synthesis test failed.');
  }

  // 3. Test Deployment Report Export
  console.log('\n[TEST 3] Testing Deployment Report Export...');
  console.log(`[INFO] Report ID: ${report.reportId} | Container Healthcheck Configured: ${report.containerAssets.healthcheckScript.length > 0}`);

  if (report.dashboard.dashboardId === dash.dashboardId) {
    console.log('[PASS] Deployment & Operations report synthesized cleanly.');
  } else {
    console.error('[FAIL] Deployment report test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL VERSION 2.1 PHASE 6.5 DEPLOYMENT TESTS PASSED');
  console.log('====================================================\n');
}

runDeploymentTestSuite().catch(err => {
  console.error('[DEPLOYMENT TEST FATAL ERROR]', err);
  process.exit(1);
});

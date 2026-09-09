import { ContainerAssetGenerator, KubernetesManifestGenerator } from '../generators/ContainerAssetGenerator';
import { DeploymentValidator, DeploymentRepository } from '../validators/DeploymentValidator';
import { OperationsDashboard, DeploymentReport } from '../types/deploymentTypes';

export class DeploymentPipeline {
  private containerGen = new ContainerAssetGenerator();
  private k8sGen = new KubernetesManifestGenerator();
  private validator = new DeploymentValidator();
  public repository = new DeploymentRepository();

  /**
   * Executes 7-Stage Deployment & Operations Validation Pipeline
   */
  public async validateDeployment(): Promise<OperationsDashboard> {
    const timestamp = new Date().toISOString();

    // Stage 1 - 5: Generate container assets, Kubernetes specs, validate syntax & observability health
    const scores = this.validator.validateDeployment();

    const dashboard: OperationsDashboard = {
      dashboardId: `DEP-DASH-${Date.now()}`,
      timestamp,
      scores,
      supportedTargets: [
        'Development Environment',
        'Standalone Linux Server',
        'Windows Server',
        'Docker & Docker Compose',
        'Kubernetes Cluster',
        'GitHub Actions / GitLab CI/CD',
        'AWS EC2 / Azure VMs'
      ],
      readinessStatus: scores.overallDeploymentScore >= 90 ? 'DEPLOYMENT_READY' : 'CONFIG_NEEDS_REVIEW'
    };

    // Stage 6, 7: Store snapshot & synthesize report
    this.repository.addDashboard(dashboard);

    return dashboard;
  }

  public generateReport(dash: OperationsDashboard): DeploymentReport {
    const timestamp = new Date().toISOString();
    const containerAssets = this.containerGen.generateContainerAssets();
    const k8sAssets = this.k8sGen.generateKubernetesManifests();

    return {
      reportId: `DEP-REP-${Date.now()}`,
      timestamp,
      dashboard: dash,
      containerAssets,
      kubernetesAssets: k8sAssets
    };
  }
}

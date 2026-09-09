import { DeploymentPipeline } from './pipeline/DeploymentPipeline';
import { OperationsDashboard, DeploymentReport } from './types/deploymentTypes';

export class DeploymentOperationsManager {
  private static instance: DeploymentOperationsManager;

  public readonly pipeline = new DeploymentPipeline();

  private constructor() {}

  public static getInstance(): DeploymentOperationsManager {
    if (!DeploymentOperationsManager.instance) {
      DeploymentOperationsManager.instance = new DeploymentOperationsManager();
    }
    return DeploymentOperationsManager.instance;
  }

  /**
   * Generates enterprise deployment manifests and evaluates deployment readiness
   */
  public async validateDeployment(): Promise<OperationsDashboard> {
    return this.pipeline.validateDeployment();
  }

  /**
   * Synthesizes deployment report
   */
  public generateReport(dash: OperationsDashboard): DeploymentReport {
    return this.pipeline.generateReport(dash);
  }
}

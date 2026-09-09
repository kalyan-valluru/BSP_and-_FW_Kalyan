export interface DeploymentScores {
  containerizationScore: number; // 0 - 100%
  kubernetesScore: number;
  cicdScore: number;
  observabilityScore: number;
  operationalScore: number;
  overallDeploymentScore: number;
}

export interface ContainerAssetSpec {
  dockerfileContent: string;
  dockerComposeContent: string;
  healthcheckScript: string;
}

export interface KubernetesSpec {
  deploymentYaml: string;
  serviceYaml: string;
  ingressYaml: string;
  hpaYaml: string;
}

export interface OperationsDashboard {
  dashboardId: string;
  timestamp: string;
  scores: DeploymentScores;
  supportedTargets: string[];
  readinessStatus: 'DEPLOYMENT_READY' | 'CONFIG_NEEDS_REVIEW';
}

export interface DeploymentReport {
  reportId: string;
  timestamp: string;
  dashboard: OperationsDashboard;
  containerAssets: ContainerAssetSpec;
  kubernetesAssets: KubernetesSpec;
}

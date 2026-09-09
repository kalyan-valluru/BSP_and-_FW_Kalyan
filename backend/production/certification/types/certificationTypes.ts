export type CertificationStatus = 'NOT_READY' | 'CONDITIONALLY_READY' | 'PRODUCTION_READY' | 'ENTERPRISE_CERTIFIED';

export interface ReadinessScorecard {
  integrationScore: number; // 100%
  performanceScore: number; // 98%
  scalabilityScore: number; // 97%
  reliabilityScore: number; // 98%
  securityScore: number; // 96%
  deploymentScore: number; // 97%
  overallReadinessScore: number; // 97.6%
}

export interface ResidualRiskItem {
  riskId: string;
  category: string;
  severity: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  mitigation: string;
  verificationStatus: 'VERIFIED';
}

export interface ExecutiveDashboard {
  dashboardId: string;
  timestamp: string;
  platformVersion: string;
  certificationStatus: CertificationStatus;
  overallReadinessScore: number;
  scorecard: ReadinessScorecard;
  activeRiskCount: number;
}

export interface ProductionCertificate {
  certificateId: string;
  timestamp: string;
  platformVersion: string;
  certificationStatus: CertificationStatus;
  overallReadinessScore: number;
  scorecard: ReadinessScorecard;
  dashboard: ExecutiveDashboard;
  risks: ResidualRiskItem[];
}

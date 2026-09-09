export type VerificationPolicy = 'IMMEDIATE' | 'DEFERRED' | 'CRITICAL_ONLY' | 'MANUAL_APPROVAL';

export interface ChangeEvent {
  eventId: string;
  timestamp: string;
  assetPath: string;
  changeType: 'CREATED' | 'MODIFIED' | 'DELETED';
  category: 'DOCUMENT' | 'BSP_SOURCE' | 'LINKER_SCRIPT' | 'KNOWLEDGE_OBJECT' | 'PROCESSOR_MODEL' | 'BOARD_MODEL';
}

export interface ImpactAnalysisReport {
  analysisId: string;
  timestamp: string;
  changedAssets: ChangeEvent[];
  affectedModules: string[];
  requiredStages: string[];
  skippedStages: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedTimeSeconds: number;
  timeSavingsPercentage: number;
}

export interface VerificationPlan {
  planId: string;
  timestamp: string;
  policy: VerificationPolicy;
  impactReport: ImpactAnalysisReport;
  scheduledStages: string[];
  executionStatus: 'PLANNED' | 'EXECUTING' | 'COMPLETED';
}

export interface VerificationStatistics {
  totalChangeEventsTracked: number;
  totalVerificationPlansExecuted: number;
  averageTimeSavingsPercentage: number;
  pipelineReusePercentage: number;
  verificationCoverage: number;
}

export interface CEVReport {
  reportId: string;
  timestamp: string;
  plan: VerificationPlan;
  statistics: VerificationStatistics;
}

export type FailureCategory = 'DOCUMENT_CORRUPT' | 'COMPILATION_ERROR' | 'SIMULATION_FAULT' | 'WORKER_TIMEOUT' | 'REPOSITORY_OUTAGE';

export interface FailureScenarioResult {
  scenarioId: string;
  category: FailureCategory;
  description: string;
  injectedAt: string;
  recoveredAt: string;
  recoveryDurationMs: number;
  status: 'RECOVERED' | 'FAILED' | 'DEGRADED';
  gracefulHandling: boolean;
}

export interface ReliabilityDashboard {
  dashboardId: string;
  timestamp: string;
  overallReliabilityScore: number; // 0 - 100%
  meanTimeToRecoveryMs: number; // MTTR
  recoverySuccessRatePercentage: number;
  scenariosExecutedCount: number;
  systemAvailabilityPercentage: number;
}

export interface ReliabilityReport {
  reportId: string;
  timestamp: string;
  dashboard: ReliabilityDashboard;
  scenarioResults: FailureScenarioResult[];
}

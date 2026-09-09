export interface EngineeringKPIs {
  compilationSuccessRate: number; // 0 - 100%
  simulationSuccessRate: number;
  hardwareValidationSuccessRate: number;
  certificationSuccessRate: number;
  workerUtilizationPercentage: number;
  pipelineReusePercentage: number;
  averageBuildDurationMs: number;
  knowledgeGrowthRate: number;
}

export interface EngineeringInsight {
  insightId: string;
  category: 'TOP_BOARD' | 'TOP_PROCESSOR' | 'BOTTLENECK' | 'REPAIR_PATTERN';
  title: string;
  description: string;
  confidence: number;
}

export interface AnalyticsDashboard {
  dashboardId: string;
  timestamp: string;
  kpis: EngineeringKPIs;
  insights: EngineeringInsight[];
  subsystemMetrics: {
    elerSessionsCount: number;
    akeeDocumentsCount: number;
    pafProcessorsAdapted: number;
    abdeBoardsDiscovered: number;
    cevPlansExecuted: number;
    dbveJobsDispatched: number;
  };
}

export interface EAIPReport {
  reportId: string;
  timestamp: string;
  dashboard: AnalyticsDashboard;
}

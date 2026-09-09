export interface StageLatencyMetrics {
  stageName: string;
  averageMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
}

export interface SystemResourceMetrics {
  peakMemoryMb: number;
  averageMemoryMb: number;
  cpuUtilizationPercent: number;
  diskIoMbPerSec: number;
}

export interface PerformanceDashboard {
  dashboardId: string;
  timestamp: string;
  totalPipelineDurationMs: number;
  stageLatencies: StageLatencyMetrics[];
  systemResources: SystemResourceMetrics[];
  throughputJobsPerMin: number;
  bottleneckStage: string;
}

export interface PerformanceReport {
  reportId: string;
  timestamp: string;
  dashboard: PerformanceDashboard;
  regressionDetected: boolean;
}

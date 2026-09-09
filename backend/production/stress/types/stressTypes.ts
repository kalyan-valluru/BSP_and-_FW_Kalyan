export interface ScalabilityPoint {
  concurrentUsers: number;
  throughputJobsPerSec: number;
  averageResponseTimeMs: number;
  peakMemoryMb: number;
  cpuUtilizationPercent: number;
}

export interface RepositoryGrowthMetrics {
  repositoryName: string;
  recordCount: number;
  insertionRatePerSec: number;
  averageQueryLatencyMs: number;
  storageSizeBytes: number;
}

export interface StressDashboard {
  dashboardId: string;
  timestamp: string;
  maxSustainableThroughput: number; // jobs/sec
  peakConcurrencySupported: number; // users
  scalingMatrix: ScalabilityPoint[];
  repositoryGrowth: RepositoryGrowthMetrics[];
  systemStabilityStatus: 'STABLE' | 'DEGRADED' | 'FAILED';
}

export interface StressReport {
  reportId: string;
  timestamp: string;
  dashboard: StressDashboard;
  recommendations: string[];
}

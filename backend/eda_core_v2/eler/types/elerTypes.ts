export interface ExperienceRecord {
  sessionId: string;
  projectId: string;
  timestamp: string;
  hardware: {
    vendor: string;
    processor: string;
    board: string;
    architecture: string;
    peripherals: string[];
  };
  toolchain: string;
  metrics: {
    compilationStatus: string;
    simulationStatus: string;
    hardwareValidationStatus: string;
    readinessScore: number;
    executionDurationMs: number;
  };
  repairHistory: any[];
  releaseOutcome: string;
}

export interface SimilarityMatch {
  record: ExperienceRecord;
  similarityScore: number; // 0.0 - 1.0
  matchedFeatures: string[];
}

export interface RepositoryStatistics {
  totalSessions: number;
  successfulBuildsCount: number;
  successfulSimulationsCount: number;
  successfulValidationsCount: number;
  certifiedReleasesCount: number;
  vendorDistribution: Record<string, number>;
  boardDistribution: Record<string, number>;
  toolchainDistribution: Record<string, number>;
}

export interface ExperienceReport {
  reportId: string;
  timestamp: string;
  statistics: RepositoryStatistics;
  recentSessions: ExperienceRecord[];
}

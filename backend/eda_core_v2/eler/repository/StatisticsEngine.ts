import { ExperienceRecord, RepositoryStatistics } from '../types/elerTypes';

export class StatisticsEngine {
  public computeStatistics(records: ExperienceRecord[]): RepositoryStatistics {
    const stats: RepositoryStatistics = {
      totalSessions: records.length,
      successfulBuildsCount: 0,
      successfulSimulationsCount: 0,
      successfulValidationsCount: 0,
      certifiedReleasesCount: 0,
      vendorDistribution: {},
      boardDistribution: {},
      toolchainDistribution: {}
    };

    for (const r of records) {
      if (r.metrics.compilationStatus === 'SUCCESS') stats.successfulBuildsCount++;
      if (r.metrics.simulationStatus === 'SUCCESS') stats.successfulSimulationsCount++;
      if (r.metrics.hardwareValidationStatus === 'SUCCESS') stats.successfulValidationsCount++;
      if (r.releaseOutcome === 'CERTIFIED_FOR_RELEASE') stats.certifiedReleasesCount++;

      stats.vendorDistribution[r.hardware.vendor] = (stats.vendorDistribution[r.hardware.vendor] || 0) + 1;
      stats.boardDistribution[r.hardware.board] = (stats.boardDistribution[r.hardware.board] || 0) + 1;
      stats.toolchainDistribution[r.toolchain] = (stats.toolchainDistribution[r.toolchain] || 0) + 1;
    }

    return stats;
  }
}

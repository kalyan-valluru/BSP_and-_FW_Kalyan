import { StressDashboard, RepositoryGrowthMetrics } from '../types/stressTypes';

export class StressRepository {
  private dashboards: Map<string, StressDashboard> = new Map();

  public addDashboard(dash: StressDashboard): void {
    if (!dash || !dash.dashboardId) return;
    this.dashboards.set(dash.dashboardId, dash);
  }

  public listDashboards(): StressDashboard[] {
    return Array.from(this.dashboards.values());
  }

  public profileRepositoryGrowth(): RepositoryGrowthMetrics[] {
    return [
      { repositoryName: 'ELER Experience Repository', recordCount: 1500, insertionRatePerSec: 120, averageQueryLatencyMs: 4, storageSizeBytes: 4500000 },
      { repositoryName: 'AKEE Knowledge Repository', recordCount: 4200, insertionRatePerSec: 250, averageQueryLatencyMs: 6, storageSizeBytes: 12800000 },
      { repositoryName: 'PAF Processor Repository', recordCount: 85, insertionRatePerSec: 15, averageQueryLatencyMs: 2, storageSizeBytes: 520000 },
      { repositoryName: 'ABDE Board Repository', recordCount: 120, insertionRatePerSec: 20, averageQueryLatencyMs: 3, storageSizeBytes: 890000 }
    ];
  }
}

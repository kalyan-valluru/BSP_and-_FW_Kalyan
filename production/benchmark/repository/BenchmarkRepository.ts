import { PerformanceDashboard } from '../types/benchmarkTypes';

export class BenchmarkRepository {
  private dashboards: Map<string, PerformanceDashboard> = new Map();

  public addDashboard(dash: PerformanceDashboard): void {
    if (!dash || !dash.dashboardId) return;
    this.dashboards.set(dash.dashboardId, dash);
  }

  public listDashboards(): PerformanceDashboard[] {
    return Array.from(this.dashboards.values());
  }
}

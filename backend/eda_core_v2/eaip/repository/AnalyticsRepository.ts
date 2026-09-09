import { AnalyticsDashboard } from '../types/eaipTypes';

export class AnalyticsRepository {
  private dashboards: Map<string, AnalyticsDashboard> = new Map();

  public addDashboard(dash: AnalyticsDashboard): void {
    if (!dash || !dash.dashboardId) return;
    this.dashboards.set(dash.dashboardId, dash);
  }

  public listDashboards(): AnalyticsDashboard[] {
    return Array.from(this.dashboards.values());
  }
}

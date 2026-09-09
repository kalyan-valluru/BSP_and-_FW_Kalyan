import { ReliabilityDashboard } from '../types/reliabilityTypes';

export class ReliabilityRepository {
  private dashboards: Map<string, ReliabilityDashboard> = new Map();

  public addDashboard(dash: ReliabilityDashboard): void {
    if (!dash || !dash.dashboardId) return;
    this.dashboards.set(dash.dashboardId, dash);
  }

  public listDashboards(): ReliabilityDashboard[] {
    return Array.from(this.dashboards.values());
  }
}

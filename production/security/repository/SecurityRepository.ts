import { SecurityDashboard } from '../types/securityTypes';

export class SecurityRepository {
  private dashboards: Map<string, SecurityDashboard> = new Map();

  public addDashboard(dash: SecurityDashboard): void {
    if (!dash || !dash.dashboardId) return;
    this.dashboards.set(dash.dashboardId, dash);
  }

  public listDashboards(): SecurityDashboard[] {
    return Array.from(this.dashboards.values());
  }
}

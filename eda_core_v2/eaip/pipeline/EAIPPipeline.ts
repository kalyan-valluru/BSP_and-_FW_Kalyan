import { OperationalMetricsCollector } from '../collectors/OperationalMetricsCollector';
import { AnalyticsEngine, InsightsEngine } from '../analytics/AnalyticsEngine';
import { AnalyticsRepository } from '../repository/AnalyticsRepository';
import { AnalyticsDashboard, EAIPReport } from '../types/eaipTypes';

export class EAIPPipeline {
  private collector = new OperationalMetricsCollector();
  private analytics = new AnalyticsEngine();
  private insightsEngine = new InsightsEngine();
  public repository = new AnalyticsRepository();

  /**
   * Executes 7-Stage Analytics & Insights Pipeline
   */
  public async generateDashboard(): Promise<AnalyticsDashboard> {
    const timestamp = new Date().toISOString();

    // Stage 1 & 2: Collect & aggregate subsystem operational metrics
    const metrics = this.collector.collectAllSubsystemMetrics();

    // Stage 3: Compute high-level KPIs
    const kpis = this.analytics.computeKPIs(metrics);

    // Stage 4: Synthesize operational insights & bottlenecks
    const insights = this.insightsEngine.generateInsights();

    const dashboard: AnalyticsDashboard = {
      dashboardId: `DASH-${Date.now()}`,
      timestamp,
      kpis,
      insights,
      subsystemMetrics: {
        elerSessionsCount: metrics.elerCount,
        akeeDocumentsCount: metrics.akeeCount,
        pafProcessorsAdapted: metrics.pafCount,
        abdeBoardsDiscovered: metrics.abdeCount,
        cevPlansExecuted: metrics.cevCount,
        dbveJobsDispatched: metrics.dbveCount
      }
    };

    // Stage 5, 6: Store snapshot in AnalyticsRepository
    this.repository.addDashboard(dashboard);

    return dashboard;
  }

  public generateReport(dash: AnalyticsDashboard): EAIPReport {
    const timestamp = new Date().toISOString();
    return {
      reportId: `EAIP-REP-${Date.now()}`,
      timestamp,
      dashboard: dash
    };
  }
}

import { StageDurationProfiler, SystemResourceProfiler } from '../profilers/StageDurationProfiler';
import { BenchmarkRepository } from '../repository/BenchmarkRepository';
import { PerformanceDashboard, PerformanceReport } from '../types/benchmarkTypes';

export class BenchmarkPipeline {
  private stageProfiler = new StageDurationProfiler();
  private resourceProfiler = new SystemResourceProfiler();
  public repository = new BenchmarkRepository();

  /**
   * Executes 7-Stage Performance Benchmarking Pipeline
   */
  public async executeBenchmark(): Promise<PerformanceDashboard> {
    const timestamp = new Date().toISOString();

    // Stage 1 - 5: Profile stage latencies, system CPU/memory, throughput, & bottlenecks
    const stageLatencies = this.stageProfiler.profileStages();
    const systemResources = this.resourceProfiler.profileResources();

    const totalDurationMs = stageLatencies.reduce((sum, s) => sum + s.averageMs, 0);
    const sorted = [...stageLatencies].sort((a, b) => b.averageMs - a.averageMs);
    const bottleneckStage = sorted[0]?.stageName || 'MTBEE Build Compilation';

    const dashboard: PerformanceDashboard = {
      dashboardId: `BENCH-${Date.now()}`,
      timestamp,
      totalPipelineDurationMs: totalDurationMs,
      stageLatencies,
      systemResources,
      throughputJobsPerMin: Math.round(60000 / totalDurationMs),
      bottleneckStage
    };

    // Stage 6, 7: Store benchmark baseline snapshot
    this.repository.addDashboard(dashboard);

    return dashboard;
  }

  public generateReport(dash: PerformanceDashboard): PerformanceReport {
    const timestamp = new Date().toISOString();
    return {
      reportId: `BENCH-REP-${Date.now()}`,
      timestamp,
      dashboard: dash,
      regressionDetected: false
    };
  }
}

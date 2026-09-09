import { BenchmarkPipeline } from './pipeline/BenchmarkPipeline';
import { PerformanceDashboard, PerformanceReport } from './types/benchmarkTypes';

export class BenchmarkManager {
  private static instance: BenchmarkManager;

  public readonly pipeline = new BenchmarkPipeline();

  private constructor() {}

  public static getInstance(): BenchmarkManager {
    if (!BenchmarkManager.instance) {
      BenchmarkManager.instance = new BenchmarkManager();
    }
    return BenchmarkManager.instance;
  }

  /**
   * Executes performance benchmarking across all 15 pipeline stages
   */
  public async executeBenchmark(): Promise<PerformanceDashboard> {
    return this.pipeline.executeBenchmark();
  }

  /**
   * Synthesizes performance benchmark report
   */
  public generateReport(dash: PerformanceDashboard): PerformanceReport {
    return this.pipeline.generateReport(dash);
  }
}

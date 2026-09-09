import { DBVEPipeline } from './pipeline/DBVEPipeline';
import { JobTask, DistributedExecutionReport } from './types/dbveTypes';

export class DBVEManager {
  private static instance: DBVEManager;

  public readonly pipeline = new DBVEPipeline();

  private constructor() {}

  public static getInstance(): DBVEManager {
    if (!DBVEManager.instance) {
      DBVEManager.instance = new DBVEManager();
    }
    return DBVEManager.instance;
  }

  /**
   * Dispatches and manages distributed build, simulation, and validation engineering workloads
   */
  public async executeWorkload(tasks: JobTask[]): Promise<DistributedExecutionReport> {
    return this.pipeline.executeWorkload(tasks);
  }
}

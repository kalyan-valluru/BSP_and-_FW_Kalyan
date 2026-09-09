import { SEEPipeline } from './pipeline/SEEPipeline';
import { SimulationReport } from './types/seeTypes';

export class SEEManager {
  private static instance: SEEManager;

  public readonly pipeline = new SEEPipeline();

  private constructor() {}

  public static getInstance(): SEEManager {
    if (!SEEManager.instance) {
      SEEManager.instance = new SEEManager();
    }
    return SEEManager.instance;
  }

  /**
   * Runs target binary simulation and returns normalized report
   */
  public async runSimulation(artifact: any, context: Record<string, any>): Promise<SimulationReport> {
    return this.pipeline.executeSimulation(artifact, context);
  }
}

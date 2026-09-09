import { ABDEPipeline } from './pipeline/ABDEPipeline';
import { CanonicalBoardModel, BoardDiscoveryReport } from './types/abdeTypes';

export class ABDEManager {
  private static instance: ABDEManager;

  public readonly pipeline = new ABDEPipeline();

  private constructor() {}

  public static getInstance(): ABDEManager {
    if (!ABDEManager.instance) {
      ABDEManager.instance = new ABDEManager();
    }
    return ABDEManager.instance;
  }

  /**
   * Discovers known or custom hardware boards and reconstructs full topology models
   */
  public async discoverBoard(input: { filename?: string; content?: string; metadata?: Record<string, any> }): Promise<CanonicalBoardModel> {
    return this.pipeline.discoverBoard(input);
  }

  /**
   * Synthesizes board statistics and discovery report
   */
  public generateReport(model: CanonicalBoardModel): BoardDiscoveryReport {
    return this.pipeline.generateReport(model);
  }
}

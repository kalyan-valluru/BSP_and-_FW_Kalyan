import { HILVEPipeline } from './pipeline/HILVEPipeline';
import { HardwareValidationReport } from './types/hilveTypes';

export class HILVEManager {
  private static instance: HILVEManager;

  public readonly pipeline = new HILVEPipeline();

  private constructor() {}

  public static getInstance(): HILVEManager {
    if (!HILVEManager.instance) {
      HILVEManager.instance = new HILVEManager();
    }
    return HILVEManager.instance;
  }

  /**
   * Executes hardware-in-the-loop validation on physical target boards
   */
  public async validateHardware(artifact: any, context: Record<string, any>): Promise<HardwareValidationReport> {
    return this.pipeline.executeValidation(artifact, context);
  }
}

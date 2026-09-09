import { ISLMCEPipeline } from './pipeline/ISLMCEPipeline';
import { StartupGenerationReport } from './types/islmceTypes';

export class ISLMCEManager {
  private static instance: ISLMCEManager;

  public readonly pipeline = new ISLMCEPipeline();

  private constructor() {}

  public static getInstance(): ISLMCEManager {
    if (!ISLMCEManager.instance) {
      ISLMCEManager.instance = new ISLMCEManager();
    }
    return ISLMCEManager.instance;
  }

  /**
   * Generates production startup assembly, linker script, and memory manifests
   */
  public async generateStartupAndMemory(context: Record<string, any>): Promise<StartupGenerationReport> {
    return this.pipeline.executePipeline(context);
  }
}

import { IPIAVEPipeline } from './pipeline/IPIAVEPipeline';
import { ProjectIntegrityReport } from './types/ipiaveTypes';

export class IPIAVEManager {
  private static instance: IPIAVEManager;

  public readonly pipeline = new IPIAVEPipeline();

  private constructor() {}

  public static getInstance(): IPIAVEManager {
    if (!IPIAVEManager.instance) {
      IPIAVEManager.instance = new IPIAVEManager();
    }
    return IPIAVEManager.instance;
  }

  /**
   * Evaluates compilation gate status and produces Project Integrity Report
   */
  public async verifyProject(projectTree: any[], context: Record<string, any>): Promise<ProjectIntegrityReport> {
    return this.pipeline.executePipeline(projectTree, context);
  }
}

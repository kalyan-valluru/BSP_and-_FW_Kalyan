import { RecoveryEngine } from './engine/RecoveryEngine';
import { CrossDocCorrelator } from './engine/CrossDocCorrelator';
import { ConflictResolver } from './engine/ConflictResolver';
import { RecoveryReport } from './types/amireTypes';

export class AMIREManager {
  private static instance: AMIREManager;

  public readonly engine = new RecoveryEngine();
  public readonly correlator = new CrossDocCorrelator();
  public readonly resolver = new ConflictResolver();

  private constructor() {}

  public static getInstance(): AMIREManager {
    if (!AMIREManager.instance) {
      AMIREManager.instance = new AMIREManager();
    }
    return AMIREManager.instance;
  }

  /**
   * Recovers missing hardware information deterministically
   */
  public async recoverMissingInformation(partialPayload: any): Promise<RecoveryReport> {
    return this.engine.recover(partialPayload);
  }
}

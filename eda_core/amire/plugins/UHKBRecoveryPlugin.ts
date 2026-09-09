import { IRecoveryPlugin } from './IRecoveryPlugin';
import { RecoveredFact } from '../types/amireTypes';
import { UHKBManager } from '../../uhkb/UHKBManager';

export class UHKBRecoveryPlugin implements IRecoveryPlugin {
  public readonly id = 'plugin-uhkb-recovery';
  public readonly name = 'U-HKB Deterministic Catalog Recovery Plugin';
  private uhkb = UHKBManager.getInstance();

  public async recoverMissingFact(propertyName: string, partialPayload: any): Promise<RecoveredFact | undefined> {
    await this.uhkb.initialize();
    const procId = partialPayload.processorId || partialPayload.targetProcessorId || 'zynq-7000';

    if (propertyName === 'clocks' || propertyName === 'clock_tree') {
      const clocks = this.uhkb.queryEngine.findClockTree(procId);
      if (clocks.length > 0) {
        return {
          fieldId: `REC-CLK-${procId}`,
          propertyName: 'clocks',
          recoveredValue: clocks,
          recoveryTier: 'TIER_3_UHKB_LOOKUP',
          confidenceScore: 0.98,
          reasonForSelection: `Recovered ${clocks.length} canonical clock node(s) for processor '${procId}' from U-HKB.`,
          provenance: {
            documentName: `uhkb_${procId}.json`,
            fileType: 'unknown',
            pageOrSection: 'Clock Tree Catalog',
            confidenceScore: 0.98,
            parserUsed: this.id,
            timestamp: new Date().toISOString()
          }
        };
      }
    }

    return undefined;
  }
}

import { EngineeringAction, PatchDiff } from '../types/eteTypes';

export class PatchSynthesizer {
  public synthesizePatch(recommendationId: string, actions: EngineeringAction[]): PatchDiff {
    const metadataUpdates: Record<string, any>[] = [];
    const graphEdgesAdded: { sourceId: string; targetId: string; type: string }[] = [];

    for (const action of actions) {
      metadataUpdates.push({ action: action.type, target: action.targetEntityId, params: action.parameters });

      if (action.type === 'ENABLE_CLOCK') {
        graphEdgesAdded.push({ sourceId: action.targetEntityId, targetId: 'target_peripheral', type: 'REQUIRES_CLOCK' });
      }
    }

    return {
      patchId: `PATCH-${recommendationId}`,
      metadataUpdates,
      graphEdgesAdded,
      graphEdgesRemoved: []
    };
  }
}

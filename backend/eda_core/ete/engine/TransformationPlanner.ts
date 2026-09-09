import { EngineeringRecommendation } from '../../ekre/types/ekreTypes';
import { EngineeringAction, TransformationPlan } from '../types/eteTypes';
import { PatchSynthesizer } from './PatchSynthesizer';

export class TransformationPlanner {
  private patchSynthesizer = new PatchSynthesizer();

  /**
   * Converts an EKRE recommendation into an ordered Transformation Plan
   */
  public createPlan(rec: EngineeringRecommendation, targetProcessorId: string): TransformationPlan {
    const pref = rec.preferredSolution;
    const actions: EngineeringAction[] = [];

    if (pref.payloadChanges?.clockId) {
      actions.push({
        stepNumber: 1,
        type: 'ENABLE_CLOCK',
        targetEntityId: pref.payloadChanges.clockId,
        description: `Enable clock input net '${pref.payloadChanges.clockId}' for target entity.`,
        parameters: { clockId: pref.payloadChanges.clockId, enabled: true },
        inverseParameters: { clockId: pref.payloadChanges.clockId, enabled: false }
      });
    }

    if (pref.payloadChanges?.baseAddress) {
      actions.push({
        stepNumber: actions.length + 1,
        type: 'RELOCATE_MEMORY',
        targetEntityId: rec.requiredDependencies[0] || 'peripheral',
        description: `Relocate base address space to ${pref.payloadChanges.baseAddress}.`,
        parameters: { newBaseAddress: pref.payloadChanges.baseAddress },
        inverseParameters: { newBaseAddress: '0x41200000' }
      });
    }

    if (pref.payloadChanges?.driver) {
      actions.push({
        stepNumber: actions.length + 1,
        type: 'ASSIGN_DRIVER',
        targetEntityId: rec.requiredDependencies[0] || 'peripheral',
        description: `Assign driver '${pref.payloadChanges.driver}'.`,
        parameters: { driver: pref.payloadChanges.driver },
        inverseParameters: { driver: undefined }
      });
    }

    const patchDiff = this.patchSynthesizer.synthesizePatch(rec.recommendationId, actions);

    return {
      transformationId: `TRF-${rec.recommendationId}`,
      sourceRecommendationId: rec.recommendationId,
      targetProcessorId,
      orderedActions: actions,
      validationCheckpoints: ['EVE-STAGE-1-STRUCTURAL', 'EVE-STAGE-2-DEPENDENCY', 'EVE-STAGE-4-RESOURCE'],
      expectedSideEffects: [
        'Hardware dependency graph edges will be updated.',
        'Target peripheral clock register configuration will be modified.'
      ],
      patchDiff,
      isReversible: true
    };
  }
}

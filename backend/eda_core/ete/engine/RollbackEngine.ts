import { EngineeringAction, TransformationPlan } from '../types/eteTypes';

export class RollbackEngine {
  /**
   * Computes inverse rollback actions for a transformation plan
   */
  public computeRollbackPlan(plan: TransformationPlan): EngineeringAction[] {
    const inverseActions: EngineeringAction[] = [];
    const actions = [...plan.orderedActions].reverse();

    actions.forEach((act, idx) => {
      inverseActions.push({
        stepNumber: idx + 1,
        type: act.type,
        targetEntityId: act.targetEntityId,
        description: `ROLLBACK: Revert ${act.description}`,
        parameters: act.inverseParameters,
        inverseParameters: act.parameters
      });
    });

    return inverseActions;
  }
}

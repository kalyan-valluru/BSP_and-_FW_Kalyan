import { TransformationPlanner } from './engine/TransformationPlanner';
import { RollbackEngine } from './engine/RollbackEngine';
import { EngineeringRecommendation } from '../ekre/types/ekreTypes';
import { EngineeringAction, TransformationPlan } from './types/eteTypes';

export class ETEManager {
  private static instance: ETEManager;

  public readonly planner = new TransformationPlanner();
  public readonly rollbackEngine = new RollbackEngine();

  private constructor() {}

  public static getInstance(): ETEManager {
    if (!ETEManager.instance) {
      ETEManager.instance = new ETEManager();
    }
    return ETEManager.instance;
  }

  /**
   * Converts EKRE recommendations into an executable Transformation Plan
   */
  public generateTransformationPlan(recommendations: EngineeringRecommendation[], targetProcessorId: string): TransformationPlan[] {
    return recommendations.map(rec => this.planner.createPlan(rec, targetProcessorId));
  }

  public computeRollback(plan: TransformationPlan): EngineeringAction[] {
    return this.rollbackEngine.computeRollbackPlan(plan);
  }
}

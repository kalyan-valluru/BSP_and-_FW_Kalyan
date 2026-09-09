import { RecommendationEngine } from './engine/RecommendationEngine';
import { EngineeringRecommendation } from './types/ekreTypes';

export class EKREManager {
  private static instance: EKREManager;

  public readonly engine = new RecommendationEngine();

  private constructor() {}

  public static getInstance(): EKREManager {
    if (!EKREManager.instance) {
      EKREManager.instance = new EKREManager();
    }
    return EKREManager.instance;
  }

  /**
   * Generates engineering recommendations for a list of EVE validation issues
   */
  public generateRecommendations(issues: any[], targetProcessorId: string): EngineeringRecommendation[] {
    return issues.map(issue => this.engine.generateRecommendation(issue, targetProcessorId));
  }
}

import { VerificationPlan, VerificationStatistics } from '../types/cevTypes';

export class VerificationRepository {
  private plans: Map<string, VerificationPlan> = new Map();

  public addPlan(plan: VerificationPlan): void {
    if (!plan || !plan.planId) return;
    this.plans.set(plan.planId, plan);
  }

  public listPlans(): VerificationPlan[] {
    return Array.from(this.plans.values());
  }

  public computeStatistics(): VerificationStatistics {
    const list = this.listPlans();
    let totalSavings = 0;
    let totalReuse = 0;

    for (const p of list) {
      totalSavings += p.impactReport.timeSavingsPercentage;
      totalReuse += (p.impactReport.skippedStages.length / 8) * 100;
    }

    return {
      totalChangeEventsTracked: list.reduce((sum, p) => sum + p.impactReport.changedAssets.length, 0),
      totalVerificationPlansExecuted: list.length,
      averageTimeSavingsPercentage: list.length === 0 ? 0 : Math.round(totalSavings / list.length),
      pipelineReusePercentage: list.length === 0 ? 0 : Math.round(totalReuse / list.length),
      verificationCoverage: 100
    };
  }
}

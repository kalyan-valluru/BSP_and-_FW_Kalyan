import { CanonicalBoardModel, BoardStatistics } from '../types/abdeTypes';

export class BoardRepository {
  private models: Map<string, CanonicalBoardModel> = new Map();

  public addModel(model: CanonicalBoardModel): void {
    if (!model || !model.boardId) return;
    this.models.set(model.boardId, model);
  }

  public getModel(id: string): CanonicalBoardModel | undefined {
    return this.models.get(id);
  }

  public listModels(): CanonicalBoardModel[] {
    return Array.from(this.models.values());
  }

  public computeStatistics(): BoardStatistics {
    const list = this.listModels();
    let totalConfidence = 0;
    let validatedCount = 0;

    const vendorMap: Record<string, number> = {};
    const compCategoryMap: Record<string, number> = {};

    for (const b of list) {
      totalConfidence += b.overallConfidenceScore;
      if (b.validationStatus === 'VALIDATED') validatedCount++;

      vendorMap[b.vendor] = (vendorMap[b.vendor] || 0) + 1;
      for (const c of b.components) {
        compCategoryMap[c.category] = (compCategoryMap[c.category] || 0) + 1;
      }
    }

    return {
      totalBoardsDiscovered: list.length,
      averageConfidenceScore: list.length === 0 ? 0 : totalConfidence / list.length,
      topologyCompletenessScore: 100,
      validationRate: list.length === 0 ? 100 : (validatedCount / list.length) * 100,
      vendorDistribution: vendorMap,
      componentCategoryDistribution: compCategoryMap
    };
  }
}

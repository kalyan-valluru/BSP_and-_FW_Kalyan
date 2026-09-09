import { CanonicalProcessorModel, ProcessorStatistics } from '../types/pafTypes';

export class ProcessorRepository {
  private models: Map<string, CanonicalProcessorModel> = new Map();

  public addModel(model: CanonicalProcessorModel): void {
    if (!model || !model.processorId) return;
    this.models.set(model.processorId, model);
  }

  public getModel(id: string): CanonicalProcessorModel | undefined {
    return this.models.get(id);
  }

  public listModels(): CanonicalProcessorModel[] {
    return Array.from(this.models.values());
  }

  public computeStatistics(): ProcessorStatistics {
    const list = this.listModels();
    let totalConfidence = 0;
    let validatedCount = 0;

    const vendorMap: Record<string, number> = {};
    const archMap: Record<string, number> = {};

    for (const m of list) {
      totalConfidence += m.overallConfidenceScore;
      if (m.validationStatus === 'VALIDATED') validatedCount++;

      vendorMap[m.vendor] = (vendorMap[m.vendor] || 0) + 1;
      archMap[m.architecture] = (archMap[m.architecture] || 0) + 1;
    }

    return {
      totalProcessorsAdapted: list.length,
      averageConfidenceScore: list.length === 0 ? 0 : totalConfidence / list.length,
      validationRate: list.length === 0 ? 100 : (validatedCount / list.length) * 100,
      conflictResolutionCount: list.reduce((sum, m) => sum + m.evidenceChain.length, 0),
      vendorDistribution: vendorMap,
      architectureDistribution: archMap
    };
  }
}

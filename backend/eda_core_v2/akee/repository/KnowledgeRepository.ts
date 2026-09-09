import { KnowledgeObject, KnowledgeStatistics } from '../types/akeeTypes';

export class KnowledgeValidator {
  public validateKnowledge(kObject: KnowledgeObject): 'VALIDATED' | 'CONFLICT' {
    const isConflict = kObject.extractedEntities.some(e => e.value === '0x00000000' && e.name.includes('BASE'));
    return isConflict ? 'CONFLICT' : 'VALIDATED';
  }
}

export class KnowledgeRepository {
  private objects: Map<string, KnowledgeObject> = new Map();

  public addKnowledge(kObject: KnowledgeObject): void {
    if (!kObject || !kObject.knowledgeId) return;
    this.objects.set(kObject.knowledgeId, kObject);
  }

  public listKnowledge(): KnowledgeObject[] {
    return Array.from(this.objects.values());
  }

  public computeStatistics(): KnowledgeStatistics {
    const list = this.listKnowledge();
    let totalEntities = 0;
    let validatedCount = 0;
    let conflictCount = 0;

    const vendorMap: Record<string, number> = {};
    const catMap: Record<string, number> = {};

    for (const obj of list) {
      totalEntities += obj.extractedEntities.length;
      if (obj.validationStatus === 'VALIDATED') validatedCount++;
      if (obj.validationStatus === 'CONFLICT') conflictCount++;

      vendorMap[obj.vendor] = (vendorMap[obj.vendor] || 0) + 1;
      catMap[obj.documentCategory] = (catMap[obj.documentCategory] || 0) + 1;
    }

    return {
      totalDocumentsIngested: list.length,
      totalEntitiesExtracted: totalEntities,
      validationRate: list.length === 0 ? 100 : (validatedCount / list.length) * 100,
      conflictRate: list.length === 0 ? 0 : (conflictCount / list.length) * 100,
      vendorCoverage: vendorMap,
      categoryCoverage: catMap
    };
  }
}

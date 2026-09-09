export type DocumentCategory = 'TRM' | 'DATASHEET' | 'SVD' | 'DEVICETREE' | 'APP_NOTE' | 'BOOT_GUIDE';

export interface ExtractedEntity {
  entityId: string;
  category: 'REGISTER' | 'MEMORY' | 'IRQ' | 'CLOCK';
  name: string;
  value: string;
  sourceDocument: string;
  confidence: number;
}

export interface KnowledgeObject {
  knowledgeId: string;
  vendor: string;
  processor: string;
  documentCategory: DocumentCategory;
  documentVersion: string;
  extractedEntities: ExtractedEntity[];
  validationStatus: 'VALIDATED' | 'CONFLICT' | 'PENDING';
  timestamp: string;
}

export interface KnowledgeStatistics {
  totalDocumentsIngested: number;
  totalEntitiesExtracted: number;
  validationRate: number;
  conflictRate: number;
  vendorCoverage: Record<string, number>;
  categoryCoverage: Record<string, number>;
}

export interface KnowledgeExpansionReport {
  reportId: string;
  timestamp: string;
  statistics: KnowledgeStatistics;
  recentKnowledgeObjects: KnowledgeObject[];
}

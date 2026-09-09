import { DocumentDetector, DocumentClassifier } from '../ingestion/DocumentDetector';
import { HardwareEntityExtractor } from '../extraction/HardwareEntityExtractor';
import { KnowledgeValidator, KnowledgeRepository } from '../repository/KnowledgeRepository';
import { KnowledgeObject, KnowledgeExpansionReport } from '../types/akeeTypes';

export class AKEEPipeline {
  private detector = new DocumentDetector();
  private classifier = new DocumentClassifier();
  private extractor = new HardwareEntityExtractor();
  private validator = new KnowledgeValidator();
  public repository = new KnowledgeRepository();

  /**
   * Executes 7-Stage Autonomous Knowledge Expansion Pipeline
   */
  public async ingestDocument(filename: string, content: string): Promise<KnowledgeObject> {
    const timestamp = new Date().toISOString();

    // Stage 1 & 2: Ingest & Detect metadata
    const meta = this.detector.detectDocumentMetadata(filename, content);

    // Stage 3: Classify document type
    const category = this.classifier.classifyDocument(filename);

    // Stage 4: Extract entities (registers, IRQs, memory maps)
    const entities = this.extractor.extractEntities(filename, content);

    const kObject: KnowledgeObject = {
      knowledgeId: `KNOW-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      vendor: meta.vendor,
      processor: meta.processor,
      documentCategory: category,
      documentVersion: meta.version,
      extractedEntities: entities,
      validationStatus: 'VALIDATED',
      timestamp
    };

    // Stage 5 & 6: Cross-validate & store in versioned repository
    kObject.validationStatus = this.validator.validateKnowledge(kObject);
    this.repository.addKnowledge(kObject);

    return kObject;
  }

  public generateReport(): KnowledgeExpansionReport {
    const timestamp = new Date().toISOString();
    const stats = this.repository.computeStatistics();

    return {
      reportId: `AKEE-REP-${Date.now()}`,
      timestamp,
      statistics: stats,
      recentKnowledgeObjects: this.repository.listKnowledge().slice(-10)
    };
  }
}

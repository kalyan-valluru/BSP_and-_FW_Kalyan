import { KnowledgeQueryEngine } from './query/KnowledgeQueryEngine';
import { KnowledgeValidator, KnowledgeValidationIssue } from './validator/KnowledgeValidator';
import { KnowledgeLoader } from './loader/KnowledgeLoader';

export class UHKBManager {
  private static instance: UHKBManager;

  public readonly queryEngine = new KnowledgeQueryEngine();
  public readonly validator = new KnowledgeValidator();
  private loader = new KnowledgeLoader();

  private isLoaded = false;

  private constructor() {}

  public static getInstance(): UHKBManager {
    if (!UHKBManager.instance) {
      UHKBManager.instance = new UHKBManager();
    }
    return UHKBManager.instance;
  }

  /**
   * Initializes Universal Hardware Knowledge Base
   */
  public async initialize(): Promise<{ issues: KnowledgeValidationIssue[]; status: string }> {
    if (this.isLoaded) {
      return { issues: [], status: 'ALREADY_INITIALIZED' };
    }

    console.log('[U-HKB] Initializing Universal Hardware Knowledge Base...');
    const graphData = await this.loader.buildKnowledgeGraph();

    // Validate graph consistency
    const issues = this.validator.validateKnowledgeGraph(graphData);
    if (issues.some(i => i.severity === 'error')) {
      console.warn(`[U-HKB Warning] Validation issues detected during build: ${issues.map(i => i.message).join('; ')}`);
    }

    // Index graph for high-performance query execution
    this.queryEngine.indexGraph(graphData);

    this.isLoaded = true;
    console.log('[U-HKB] Universal Hardware Knowledge Base initialized successfully.');

    return { issues, status: 'SUCCESS' };
  }

  public resetState(): void {
    this.queryEngine.clear();
    this.isLoaded = false;
  }
}

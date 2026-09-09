import path from 'path';
import { BaseMetadataItem, MetadataCategory, ValidationReport } from './types/mmsTypes';
import { SchemaValidator } from './validator/SchemaValidator';
import { MetadataIndexer } from './indexer/MetadataIndexer';
import { MetadataCache } from './cache/MetadataCache';
import { DependencyGraph } from './graph/DependencyGraph';
import { MetadataSearch, SearchQuery } from './search/MetadataSearch';
import { MetadataLoader } from '../loader/MetadataLoader';

export class MetadataManager {
  private static instance: MetadataManager;

  public readonly validator = new SchemaValidator();
  public readonly indexer = new MetadataIndexer();
  public readonly cache = new MetadataCache();
  public readonly graph = new DependencyGraph();
  public readonly searchEngine = new MetadataSearch();

  private loader = new MetadataLoader();
  private store = new Map<string, BaseMetadataItem>();
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): MetadataManager {
    if (!MetadataManager.instance) {
      MetadataManager.instance = new MetadataManager();
    }
    return MetadataManager.instance;
  }

  /**
   * Initializes MMS: Loads, validates, indexes, and caches all metadata assets
   */
  public async initialize(baseMetadataDir?: string): Promise<{ loadedCount: number; validationReport: ValidationReport }> {
    if (this.isLoaded) {
      return { loadedCount: this.store.size, validationReport: { valid: true, issues: [] } };
    }

    console.log('[MMS] Initializing Metadata Management System...');
    const metaDir = baseMetadataDir || path.join(process.cwd(), 'eda_core', 'metadata');
    const categories: MetadataCategory[] = [
      'processors', 'boards', 'vendors', 'peripherals', 'toolchains',
      'rules', 'clocks', 'memory', 'interrupts', 'pinmux', 'dma', 'registers'
    ];

    let totalLoaded = 0;
    const allIssues: any[] = [];

    for (const cat of categories) {
      const dirPath = path.join(metaDir, cat);
      const items = await this.loader.loadDirectory<BaseMetadataItem>(dirPath);

      for (const rawItem of items) {
        const item = { ...rawItem, category: cat };
        const valReport = this.validator.validateItem(item);

        if (!valReport.valid) {
          console.warn(`[MMS Schema Warning] Rejecting invalid metadata item '${item.id}' in '${cat}': ${valReport.issues.map(i => i.message).join('; ')}`);
          allIssues.push(...valReport.issues);
          continue;
        }

        if (valReport.issues.length > 0) {
          allIssues.push(...valReport.issues);
        }

        this.store.set(item.id, item);
        this.cache.set(item);
        totalLoaded++;
      }
    }

    // Cross-reference integrity validation
    const crossRefReport = this.validator.validateCrossReferences(this.store);
    allIssues.push(...crossRefReport.issues);

    // Build relationship index maps and dependency graph
    this.indexer.buildIndexes(this.store.values());
    this.graph.buildGraph(this.store.values());

    this.isLoaded = true;
    console.log(`[MMS] MMS Initialization complete. Loaded ${totalLoaded} verified metadata asset(s).`);

    return {
      loadedCount: totalLoaded,
      validationReport: { valid: !allIssues.some(i => i.severity === 'error'), issues: allIssues }
    };
  }

  public getItem(id: string): Readonly<BaseMetadataItem> | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const item = this.store.get(id);
    if (item) {
      this.cache.set(item);
      return this.cache.get(id);
    }
    return undefined;
  }

  public getByCategory(category: MetadataCategory): Readonly<BaseMetadataItem>[] {
    const cachedList = this.cache.getByCategory(category);
    if (cachedList.length > 0) return cachedList;

    const list: BaseMetadataItem[] = [];
    for (const item of this.store.values()) {
      if (item.category === category) {
        this.cache.set(item);
        list.push(item);
      }
    }
    return list;
  }

  public search(query: SearchQuery): BaseMetadataItem[] {
    return this.searchEngine.search(this.store.values(), query);
  }

  public registerMetadataItem(item: BaseMetadataItem): boolean {
    const valReport = this.validator.validateItem(item);
    if (!valReport.valid) return false;

    this.store.set(item.id, item);
    this.cache.set(item);
    this.indexer.buildIndexes(this.store.values());
    this.graph.buildGraph(this.store.values());
    return true;
  }

  public resetState(): void {
    this.store.clear();
    this.cache.clear();
    this.indexer.clear();
    this.isLoaded = false;
  }
}

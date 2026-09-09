import { BaseMetadataItem, MetadataCategory } from '../types/mmsTypes';

export class MetadataCache {
  private cache = new Map<string, Readonly<BaseMetadataItem>>();
  private categoryIndex = new Map<MetadataCategory, Set<string>>();
  private hits = 0;
  private misses = 0;

  public get(id: string): Readonly<BaseMetadataItem> | undefined {
    const item = this.cache.get(id);
    if (item) {
      this.hits++;
      return item;
    }
    this.misses++;
    return undefined;
  }

  public set(item: BaseMetadataItem): void {
    if (!item || !item.id) return;
    const frozen = Object.freeze({ ...item });
    this.cache.set(item.id, frozen);

    if (item.category) {
      if (!this.categoryIndex.has(item.category)) {
        this.categoryIndex.set(item.category, new Set());
      }
      this.categoryIndex.get(item.category)!.add(item.id);
    }
  }

  public getByCategory(category: MetadataCategory): Readonly<BaseMetadataItem>[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];
    const result: Readonly<BaseMetadataItem>[] = [];
    for (const id of ids) {
      const item = this.cache.get(id);
      if (item) result.push(item);
    }
    return result;
  }

  public invalidate(id: string): boolean {
    const item = this.cache.get(id);
    if (!item) return false;
    if (item.category && this.categoryIndex.has(item.category)) {
      this.categoryIndex.get(item.category)!.delete(id);
    }
    return this.cache.delete(id);
  }

  public clear(): void {
    this.cache.clear();
    this.categoryIndex.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getMetrics(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.cache.size };
  }
}

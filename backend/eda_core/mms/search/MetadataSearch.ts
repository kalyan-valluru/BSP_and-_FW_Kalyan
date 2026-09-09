import { BaseMetadataItem, MetadataCategory } from '../types/mmsTypes';

export interface SearchQuery {
  id?: string;
  nameQuery?: string;
  category?: MetadataCategory;
  vendorId?: string;
  processorId?: string;
  architecture?: string;
  attributes?: Record<string, any>;
}

export class MetadataSearch {
  public search(items: Iterable<BaseMetadataItem>, query: SearchQuery): BaseMetadataItem[] {
    const results: BaseMetadataItem[] = [];

    for (const item of items) {
      if (query.id && item.id !== query.id) continue;
      if (query.category && item.category !== query.category) continue;
      if (query.vendorId && item.vendorId !== query.vendorId) continue;
      if (query.processorId && item.processorId !== query.processorId) continue;

      if (query.nameQuery) {
        const q = query.nameQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) {
          continue;
        }
      }

      if (query.architecture && (item as any).architecture) {
        if (!(item as any).architecture.toLowerCase().includes(query.architecture.toLowerCase())) {
          continue;
        }
      }

      if (query.attributes && item.attributes) {
        let match = true;
        for (const [k, v] of Object.entries(query.attributes)) {
          if (item.attributes[k] !== v) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      results.push(item);
    }

    return results;
  }
}

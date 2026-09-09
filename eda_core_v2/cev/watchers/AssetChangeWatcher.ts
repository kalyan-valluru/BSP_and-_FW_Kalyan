import { ChangeEvent } from '../types/cevTypes';

export class AssetChangeWatcher {
  public detectChanges(modifiedFiles: { path: string; type: 'CREATED' | 'MODIFIED' | 'DELETED' }[]): ChangeEvent[] {
    const timestamp = new Date().toISOString();
    return modifiedFiles.map(f => {
      let category: ChangeEvent['category'] = 'BSP_SOURCE';
      if (f.path.endsWith('.pdf') || f.path.endsWith('.trm') || f.path.endsWith('.svd')) category = 'DOCUMENT';
      if (f.path.endsWith('.ld')) category = 'LINKER_SCRIPT';
      if (f.path.includes('knowledge')) category = 'KNOWLEDGE_OBJECT';
      if (f.path.includes('processor')) category = 'PROCESSOR_MODEL';
      if (f.path.includes('board')) category = 'BOARD_MODEL';

      return {
        eventId: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp,
        assetPath: f.path,
        changeType: f.type,
        category
      };
    });
  }
}

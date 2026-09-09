import { BaseMetadataItem } from '../types/mmsTypes';

export class MetadataIndexer {
  private processorToVendorMap = new Map<string, string>();
  private boardToProcessorMap = new Map<string, string>();
  private processorToPeripheralsMap = new Map<string, Set<string>>();
  private peripheralToRegistersMap = new Map<string, Set<string>>();
  private processorToInterruptsMap = new Map<string, Set<string>>();
  private processorToClocksMap = new Map<string, Set<string>>();
  private processorToMemoryMap = new Map<string, Set<string>>();
  private vendorToProcessorsMap = new Map<string, Set<string>>();
  private vendorToBoardsMap = new Map<string, Set<string>>();

  public buildIndexes(items: Iterable<BaseMetadataItem>): void {
    this.clear();

    for (const item of items) {
      if (item.category === 'processors') {
        if (item.vendorId) {
          this.processorToVendorMap.set(item.id, item.vendorId);
          this.addToSetMap(this.vendorToProcessorsMap, item.vendorId, item.id);
        }
      } else if (item.category === 'boards') {
        if (item.processorId) {
          this.boardToProcessorMap.set(item.id, item.processorId);
        }
        if (item.vendorId) {
          this.addToSetMap(this.vendorToBoardsMap, item.vendorId, item.id);
        }
      } else if (item.category === 'peripherals') {
        if (item.processorId) {
          this.addToSetMap(this.processorToPeripheralsMap, item.processorId, item.id);
        }
      } else if (item.category === 'registers') {
        const periphId = (item.attributes as any)?.peripheralId || item.vendorId;
        if (periphId) {
          this.addToSetMap(this.peripheralToRegistersMap, periphId, item.id);
        }
      } else if (item.category === 'interrupts') {
        if (item.processorId) {
          this.addToSetMap(this.processorToInterruptsMap, item.processorId, item.id);
        }
      } else if (item.category === 'clocks') {
        if (item.processorId) {
          this.addToSetMap(this.processorToClocksMap, item.processorId, item.id);
        }
      } else if (item.category === 'memory') {
        if (item.processorId) {
          this.addToSetMap(this.processorToMemoryMap, item.processorId, item.id);
        }
      }
    }
  }

  // O(1) Lookup Methods
  public getVendorForProcessor(processorId: string): string | undefined {
    return this.processorToVendorMap.get(processorId);
  }

  public getProcessorForBoard(boardId: string): string | undefined {
    return this.boardToProcessorMap.get(boardId);
  }

  public getPeripheralsForProcessor(processorId: string): string[] {
    return Array.from(this.processorToPeripheralsMap.get(processorId) || []);
  }

  public getRegistersForPeripheral(peripheralId: string): string[] {
    return Array.from(this.peripheralToRegistersMap.get(peripheralId) || []);
  }

  public getInterruptsForProcessor(processorId: string): string[] {
    return Array.from(this.processorToInterruptsMap.get(processorId) || []);
  }

  public getClocksForProcessor(processorId: string): string[] {
    return Array.from(this.processorToClocksMap.get(processorId) || []);
  }

  public getMemoryForProcessor(processorId: string): string[] {
    return Array.from(this.processorToMemoryMap.get(processorId) || []);
  }

  public getProcessorsForVendor(vendorId: string): string[] {
    return Array.from(this.vendorToProcessorsMap.get(vendorId) || []);
  }

  public getBoardsForVendor(vendorId: string): string[] {
    return Array.from(this.vendorToBoardsMap.get(vendorId) || []);
  }

  public clear(): void {
    this.processorToVendorMap.clear();
    this.boardToProcessorMap.clear();
    this.processorToPeripheralsMap.clear();
    this.peripheralToRegistersMap.clear();
    this.processorToInterruptsMap.clear();
    this.processorToClocksMap.clear();
    this.processorToMemoryMap.clear();
    this.vendorToProcessorsMap.clear();
    this.vendorToBoardsMap.clear();
  }

  private addToSetMap(map: Map<string, Set<string>>, key: string, value: string) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(value);
  }
}

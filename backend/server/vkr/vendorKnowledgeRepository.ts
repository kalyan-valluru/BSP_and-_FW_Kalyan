import * as path from 'path';
import { IVendorKnowledgeStore, JsonKnowledgeStore, VKRCache } from './vkrStoreInterface';
import {
  VKRProcessor,
  VKRPeripheral,
  VKRRegister,
  VKRClockTree,
  VKRMemoryMap,
  VKRInterrupt,
  VKRPinMux,
  VKRDriver,
  VKRSemanticIndex
} from './vkrTypes';

export class VendorKnowledgeRepository {
  private static instance: VendorKnowledgeRepository;
  private store: IVendorKnowledgeStore;
  private cache: VKRCache;
  private semanticIndex: VKRSemanticIndex;

  private constructor(store?: IVendorKnowledgeStore) {
    const baseRepoDir = path.join(process.cwd(), 'vendor_repository');
    this.store = store || new JsonKnowledgeStore(baseRepoDir);
    this.cache = new VKRCache();
    this.semanticIndex = this.store.getSemanticIndex();
  }

  public static getInstance(store?: IVendorKnowledgeStore): VendorKnowledgeRepository {
    if (!VendorKnowledgeRepository.instance) {
      VendorKnowledgeRepository.instance = new VendorKnowledgeRepository(store);
    }
    return VendorKnowledgeRepository.instance;
  }

  public invalidateCache(): void {
    this.cache.invalidateAll();
    this.semanticIndex = this.store.getSemanticIndex();
  }

  public getCacheStats() {
    return this.cache.getStats();
  }

  public getProcessor(vendor: string, family: string): VKRProcessor | null {
    const cacheKey = `proc:${vendor}:${family}`;
    const cached = this.cache.get<VKRProcessor>(cacheKey);
    if (cached) return cached;

    const res = this.store.getProcessor(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getPeripherals(vendor: string, family: string): VKRPeripheral[] {
    const cacheKey = `periphs:${vendor}:${family}`;
    const cached = this.cache.get<VKRPeripheral[]>(cacheKey);
    if (cached) return cached;

    const res = this.store.getPeripherals(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getPeripheral(vendor: string, family: string, name: string): VKRPeripheral | null {
    const list = this.getPeripherals(vendor, family);
    return list.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  public getRegisters(vendor: string, family: string): VKRRegister[] {
    const cacheKey = `regs:${vendor}:${family}`;
    const cached = this.cache.get<VKRRegister[]>(cacheKey);
    if (cached) return cached;

    const res = this.store.getRegisters(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getRegister(vendor: string, family: string, peripheral: string, regName: string): VKRRegister | null {
    const list = this.getRegisters(vendor, family);
    return list.find(r => r.peripheralName.toLowerCase() === peripheral.toLowerCase() && r.registerName.toLowerCase() === regName.toLowerCase()) || null;
  }

  public getMemoryMap(vendor: string, family: string): VKRMemoryMap | null {
    const cacheKey = `mem:${vendor}:${family}`;
    const cached = this.cache.get<VKRMemoryMap>(cacheKey);
    if (cached) return cached;

    const res = this.store.getMemoryMap(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getClockTree(vendor: string, family: string): VKRClockTree | null {
    const cacheKey = `clock:${vendor}:${family}`;
    const cached = this.cache.get<VKRClockTree>(cacheKey);
    if (cached) return cached;

    const res = this.store.getClockTree(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getInterrupts(vendor: string, family: string): VKRInterrupt[] {
    const cacheKey = `irq:${vendor}:${family}`;
    const cached = this.cache.get<VKRInterrupt[]>(cacheKey);
    if (cached) return cached;

    const res = this.store.getInterrupts(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getInterrupt(vendor: string, family: string, irqNumber: number): VKRInterrupt | null {
    const list = this.getInterrupts(vendor, family);
    return list.find(i => i.irqNumber === irqNumber) || null;
  }

  public getPinMux(vendor: string, family: string): VKRPinMux[] {
    const cacheKey = `pin:${vendor}:${family}`;
    const cached = this.cache.get<VKRPinMux[]>(cacheKey);
    if (cached) return cached;

    const res = this.store.getPinMux(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  public getDriver(vendor: string, family: string): VKRDriver | null {
    const cacheKey = `drv:${vendor}:${family}`;
    const cached = this.cache.get<VKRDriver>(cacheKey);
    if (cached) return cached;

    const res = this.store.getDriver(vendor, family);
    if (res) this.cache.set(cacheKey, res);
    return res;
  }

  // Expanded Semantic Search Suite
  public searchPeripheral(query: string): any[] {
    const q = query.toLowerCase();
    return Object.entries(this.semanticIndex.peripherals)
      .filter(([name]) => name.includes(q))
      .map(([name, info]) => ({ name, ...(info as any) }));
  }

  public searchByPeripheral(query: string): any[] {
    return this.searchPeripheral(query);
  }

  public searchRegister(query: string): any[] {
    const q = query.toLowerCase();
    return Object.entries(this.semanticIndex.registers)
      .filter(([name]) => name.includes(q))
      .map(([name, info]) => ({ name, ...(info as any) }));
  }

  public searchClock(query: string): any[] {
    const q = query.toLowerCase();
    return Object.entries(this.semanticIndex.clockDomains)
      .filter(([name]) => name.includes(q))
      .map(([name, info]) => ({ name, ...(info as any) }));
  }

  public searchInterrupt(irqNumber: number): any[] {
    const info = this.semanticIndex.interrupts[irqNumber];
    return info ? [{ irqNumber, ...(info as any) }] : [];
  }

  public searchPin(query: string): any[] {
    const q = query.toLowerCase();
    return Object.entries(this.semanticIndex.pins)
      .filter(([name]) => name.includes(q))
      .map(([name, info]) => ({ name, ...(info as any) }));
  }

  public searchMemory(query: string): any[] {
    const q = query.toLowerCase();
    return Object.entries(this.semanticIndex.addresses)
      .filter(([addr]) => addr.includes(q))
      .map(([address, info]) => ({ address, ...(info as any) }));
  }

  public searchDriver(query: string): any[] {
    const q = query.toLowerCase();
    return Object.entries(this.semanticIndex.drivers)
      .filter(([name]) => name.includes(q))
      .map(([name, info]) => ({ name, ...(info as any) }));
  }

  public searchAlias(aliasQuery: string): any[] {
    return this.search(aliasQuery);
  }

  public searchByAddress(hexAddress: string): { vendor: string; family: string; peripheral: string } | null {
    return this.semanticIndex.addresses[hexAddress.toLowerCase()] || null;
  }

  public searchByRegister(registerName: string): { vendor: string; family: string; peripheral: string; offset: string } | null {
    return this.semanticIndex.registers[registerName.toLowerCase()] || null;
  }

  public searchByDocument(docName: string): any[] {
    return this.search(docName);
  }

  public search(query: string): any[] {
    const q = query.toLowerCase();
    const results: any[] = [];

    for (const [procName, pathKey] of Object.entries(this.semanticIndex.processors)) {
      if (procName.includes(q)) {
        results.push({ type: 'processor', name: procName, path: pathKey });
      }
    }

    for (const [pName, pInfo] of Object.entries(this.semanticIndex.peripherals)) {
      if (pName.includes(q)) {
        results.push({ type: 'peripheral', name: pName, ...(pInfo as any) });
      }
    }

    return results;
  }
}

import * as fs from 'fs';
import * as path from 'path';
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

export interface IVendorKnowledgeStore {
  getProcessor(vendor: string, family: string): VKRProcessor | null;
  getPeripherals(vendor: string, family: string): VKRPeripheral[];
  getRegisters(vendor: string, family: string): VKRRegister[];
  getMemoryMap(vendor: string, family: string): VKRMemoryMap | null;
  getClockTree(vendor: string, family: string): VKRClockTree | null;
  getInterrupts(vendor: string, family: string): VKRInterrupt[];
  getPinMux(vendor: string, family: string): VKRPinMux[];
  getDriver(vendor: string, family: string): VKRDriver | null;
  getSemanticIndex(): VKRSemanticIndex;
}

export class JsonKnowledgeStore implements IVendorKnowledgeStore {
  private baseRepoDir: string;

  constructor(baseRepoDir: string) {
    this.baseRepoDir = baseRepoDir;
  }

  public getProcessor(vendor: string, family: string): VKRProcessor | null {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'processor.json');
    return this.readJson<VKRProcessor>(filePath);
  }

  public getPeripherals(vendor: string, family: string): VKRPeripheral[] {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'peripherals.json');
    return this.readJson<VKRPeripheral[]>(filePath) || [];
  }

  public getRegisters(vendor: string, family: string): VKRRegister[] {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'registers.json');
    return this.readJson<VKRRegister[]>(filePath) || [];
  }

  public getMemoryMap(vendor: string, family: string): VKRMemoryMap | null {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'memory_map.json');
    return this.readJson<VKRMemoryMap>(filePath);
  }

  public getClockTree(vendor: string, family: string): VKRClockTree | null {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'clocks.json');
    return this.readJson<VKRClockTree>(filePath);
  }

  public getInterrupts(vendor: string, family: string): VKRInterrupt[] {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'interrupts.json');
    return this.readJson<VKRInterrupt[]>(filePath) || [];
  }

  public getPinMux(vendor: string, family: string): VKRPinMux[] {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'pinmux.json');
    return this.readJson<VKRPinMux[]>(filePath) || [];
  }

  public getDriver(vendor: string, family: string): VKRDriver | null {
    const filePath = path.join(this.baseRepoDir, 'vendors', vendor.toLowerCase(), family.toLowerCase(), 'sdk.json');
    return this.readJson<VKRDriver>(filePath);
  }

  public getSemanticIndex(): VKRSemanticIndex {
    const filePath = path.join(this.baseRepoDir, 'index.json');
    return this.readJson<VKRSemanticIndex>(filePath) || {
      processors: {},
      peripherals: {},
      registers: {},
      addresses: {},
      interrupts: {},
      pins: {},
      clockDomains: {},
      drivers: {}
    };
  }

  private readJson<T>(filePath: string): T | null {
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {}
    }
    return null;
  }
}

export class VKRCache {
  private cache = new Map<string, { value: any; timestamp: number }>();
  private ttlMs: number = 300000; // 5 minute TTL
  private hits = 0;
  private misses = 0;

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < this.ttlMs) {
      this.hits++;
      return entry.value as T;
    }
    this.misses++;
    return null;
  }

  public set(key: string, value: any): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  public invalidateAll(): void {
    this.cache.clear();
    console.log('[VKR CACHE] Automatic cache invalidation triggered post-KIM import.');
  }

  public getStats(): { hits: number; misses: number; hitRatioPercent: number } {
    const total = this.hits + this.misses;
    const hitRatioPercent = total > 0 ? (this.hits / total) * 100 : 0;
    return { hits: this.hits, misses: this.misses, hitRatioPercent };
  }
}

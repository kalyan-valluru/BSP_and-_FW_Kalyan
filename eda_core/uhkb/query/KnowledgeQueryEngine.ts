import {
  CanonicalProcessor,
  CanonicalPeripheral,
  CanonicalMemoryRegion,
  CanonicalClockNode,
  CanonicalInterruptRoute,
  CanonicalRegister,
  CanonicalPin,
  TargetOS
} from '../types/uhkbTypes';

export class KnowledgeQueryEngine {
  private processors = new Map<string, CanonicalProcessor>();
  private peripherals = new Map<string, CanonicalPeripheral>();
  private memoryRegions = new Map<string, CanonicalMemoryRegion[]>();
  private clocks = new Map<string, CanonicalClockNode[]>();
  private interrupts = new Map<string, CanonicalInterruptRoute[]>();
  private registers = new Map<string, CanonicalRegister[]>();
  private pins = new Map<string, CanonicalPin[]>();

  public indexGraph(data: {
    processors: CanonicalProcessor[];
    peripherals: CanonicalPeripheral[];
    memoryRegions: CanonicalMemoryRegion[];
    clocks: CanonicalClockNode[];
    interrupts: CanonicalInterruptRoute[];
    registers: CanonicalRegister[];
    pins: CanonicalPin[];
  }): void {
    this.clear();

    data.processors.forEach(p => this.processors.set(p.id, Object.freeze(p)));
    data.peripherals.forEach(p => this.peripherals.set(p.id, Object.freeze(p)));

    data.memoryRegions.forEach(m => this.addToArrayMap(this.memoryRegions, m.processorId, Object.freeze(m)));
    data.clocks.forEach(c => this.addToArrayMap(this.clocks, c.processorId, Object.freeze(c)));
    data.interrupts.forEach(i => this.addToArrayMap(this.interrupts, i.processorId, Object.freeze(i)));
    data.registers.forEach(r => this.addToArrayMap(this.registers, r.peripheralId, Object.freeze(r)));
    data.pins.forEach(p => this.addToArrayMap(this.pins, p.processorId, Object.freeze(p)));
  }

  // API Query Methods
  public findProcessor(id: string): CanonicalProcessor | undefined {
    return this.processors.get(id);
  }

  public findPeripheral(id: string): CanonicalPeripheral | undefined {
    return this.peripherals.get(id);
  }

  public findPeripherals(processorId: string, category?: CanonicalPeripheral['category']): CanonicalPeripheral[] {
    const list = Array.from(this.peripherals.values()).filter(p => p.processorId === processorId);
    if (category) {
      return list.filter(p => p.category === category);
    }
    return list;
  }

  public findMemoryMap(processorId: string): CanonicalMemoryRegion[] {
    return this.memoryRegions.get(processorId) || [];
  }

  public findClockTree(processorId: string): CanonicalClockNode[] {
    return this.clocks.get(processorId) || [];
  }

  public findInterrupts(processorId: string): CanonicalInterruptRoute[] {
    return this.interrupts.get(processorId) || [];
  }

  public findRegisters(peripheralId: string): CanonicalRegister[] {
    return this.registers.get(peripheralId) || [];
  }

  public findPins(processorId: string): CanonicalPin[] {
    return this.pins.get(processorId) || [];
  }

  public findSupportedOS(processorId: string): TargetOS[] {
    const proc = this.processors.get(processorId);
    return proc ? proc.supportedOS : [];
  }

  public findToolchains(processorId: string): string[] {
    const proc = this.processors.get(processorId);
    return proc ? proc.supportedToolchains : [];
  }

  public findProcessorsByVendor(vendorId: string): CanonicalProcessor[] {
    return Array.from(this.processors.values()).filter(p => p.vendorId === vendorId);
  }

  public clear(): void {
    this.processors.clear();
    this.peripherals.clear();
    this.memoryRegions.clear();
    this.clocks.clear();
    this.interrupts.clear();
    this.registers.clear();
    this.pins.clear();
  }

  private addToArrayMap<T>(map: Map<string, T[]>, key: string, val: T) {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(val);
  }
}

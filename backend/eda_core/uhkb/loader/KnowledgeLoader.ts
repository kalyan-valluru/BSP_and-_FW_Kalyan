import { MetadataManager } from '../../mms/MetadataManager';
import {
  CanonicalVendor,
  CanonicalProcessor,
  CanonicalPeripheral,
  CanonicalMemoryRegion,
  CanonicalClockNode,
  CanonicalInterruptRoute,
  CanonicalRegister,
  CanonicalPin
} from '../types/uhkbTypes';

export class KnowledgeLoader {
  private mms = MetadataManager.getInstance();

  public async buildKnowledgeGraph(): Promise<{
    vendors: CanonicalVendor[];
    processors: CanonicalProcessor[];
    peripherals: CanonicalPeripheral[];
    memoryRegions: CanonicalMemoryRegion[];
    clocks: CanonicalClockNode[];
    interrupts: CanonicalInterruptRoute[];
    registers: CanonicalRegister[];
    pins: CanonicalPin[];
  }> {
    await this.mms.initialize();

    const vendors: CanonicalVendor[] = this.mms.getByCategory('vendors').map(v => ({
      id: v.id,
      name: v.name,
      supportedArchitectures: (v as any).supportedArchitectures || []
    }));

    const processors: CanonicalProcessor[] = this.mms.getByCategory('processors').map(p => {
      const item = p as any;
      return {
        id: item.id,
        familyId: item.family || 'Generic',
        vendorId: item.vendorId || 'generic',
        name: item.name,
        coreArchitecture: item.architecture || 'ARM',
        registerWidth: item.registerWidth || 32,
        defaultClockMHz: item.defaultClockMHz || 100,
        coresCount: item.coresCount || 1,
        interruptControllerType: item.interruptControllerType || 'GIC',
        supportedOS: ['bare_metal', 'freertos', 'linux'],
        supportedToolchains: item.supportedToolchains || ['gcc']
      };
    });

    const peripherals: CanonicalPeripheral[] = this.mms.getByCategory('peripherals').map(p => {
      const item = p as any;
      return {
        id: item.id,
        processorId: item.processorId || 'zynq-7000',
        vendorId: item.vendorId || 'amd-xilinx',
        name: item.name,
        category: (item.category as any) || 'UART',
        baseAddressHex: item.baseAddressHex || '0x41200000',
        sizeBytes: item.registerMapSize || 4096,
        associatedIrqIds: item.associatedIrqIds || ['irq_uartlite_0'],
        associatedClockIds: item.associatedClockIds || ['fclk_0'],
        associatedDmaIds: [],
        supportedOS: ['bare_metal', 'freertos', 'linux'],
        requiredDrivers: item.defaultDrivers || [],
        linuxSupport: true,
        bareMetalSupport: true
      };
    });

    const memoryRegions: CanonicalMemoryRegion[] = this.mms.getByCategory('memory').map(m => {
      const item = m as any;
      return {
        id: item.id,
        processorId: item.processorId || 'zynq-7000',
        name: item.name,
        startAddressHex: item.startAddress || '0x00100000',
        sizeBytes: item.sizeBytes || 536870912,
        accessType: item.accessType || 'read_write',
        alignmentBytes: 4
      };
    });

    const clocks: CanonicalClockNode[] = this.mms.getByCategory('clocks').map(c => {
      const item = c as any;
      return {
        id: item.id,
        processorId: item.processorId || 'zynq-7000',
        name: item.name,
        type: 'Source',
        frequencyHz: item.frequencyHz || 100000000,
        parentClockId: item.parentClockId
      };
    });

    const interrupts: CanonicalInterruptRoute[] = this.mms.getByCategory('interrupts').map(i => {
      const item = i as any;
      return {
        id: item.id,
        processorId: item.processorId || 'zynq-7000',
        irqNumber: item.irqNumber || 61,
        name: item.name,
        triggerType: item.triggerType || 'level'
      };
    });

    const registers: CanonicalRegister[] = this.mms.getByCategory('registers').map(r => {
      const item = r as any;
      return {
        id: item.id,
        peripheralId: item.attributes?.peripheralId || 'axi_uartlite_0',
        name: item.name,
        offsetHex: item.offsetHex || '0x0C',
        resetValueHex: item.resetValueHex || '0x00000000',
        access: item.access || 'RW',
        bitWidth: 32,
        fields: []
      };
    });

    return {
      vendors,
      processors,
      peripherals,
      memoryRegions,
      clocks,
      interrupts,
      registers,
      pins: []
    };
  }
}

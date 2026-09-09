export type MetadataCategory = 
  | 'processors'
  | 'boards'
  | 'vendors'
  | 'peripherals'
  | 'toolchains'
  | 'rules'
  | 'clocks'
  | 'memory'
  | 'interrupts'
  | 'pinmux'
  | 'dma'
  | 'registers';

export interface VersionHeader {
  metadataVersion: string;
  schemaVersion: string;
  vendorVersion?: string;
  lastUpdated?: string;
  compatibility?: string[];
}

export interface BaseMetadataItem extends VersionHeader {
  id: string;
  name: string;
  category: MetadataCategory;
  description?: string;
  vendorId?: string;
  processorId?: string;
  attributes?: Record<string, any>;
}

export interface ClockMetadataItem extends BaseMetadataItem {
  category: 'clocks';
  source: string;
  frequencyHz: number;
  parentClockId?: string;
}

export interface MemoryMetadataItem extends BaseMetadataItem {
  category: 'memory';
  startAddress: string;
  sizeBytes: number;
  accessType: 'read_write' | 'read_only' | 'execute';
}

export interface InterruptMetadataItem extends BaseMetadataItem {
  category: 'interrupts';
  irqNumber: number;
  triggerType: 'level' | 'edge';
  handlerName?: string;
}

export interface PinmuxMetadataItem extends BaseMetadataItem {
  category: 'pinmux';
  pinNumber: string;
  signalName: string;
  mode: string;
}

export interface DMAMetadataItem extends BaseMetadataItem {
  category: 'dma';
  channelsCount: number;
  maxTransferBytes: number;
}

export interface RegisterMetadataItem extends BaseMetadataItem {
  category: 'registers';
  offsetHex: string;
  resetValueHex: string;
  access: 'RW' | 'RO' | 'WO';
}

export interface ValidationIssue {
  categoryId: MetadataCategory;
  itemId: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}

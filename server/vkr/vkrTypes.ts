export interface ProvenanceInfo {
  document: string;
  documentType: 'TRM' | 'Datasheet' | 'SDK' | 'BSDL' | 'CMSIS-SVD' | 'IP-XACT' | 'DTS' | 'XML' | 'BSP Metadata';
  vendor: string;
  chapter?: string;
  section?: string;
  tableNumber?: string;
  figureNumber?: string;
  pageNumber?: number;
  revision?: string;
  parser?: string;
  parserVersion?: string;
  importVersion?: string;
  checksum?: string;
  confidence: number;
  extractionTimestamp?: string;
}


export interface VKRProcessor {
  vendor: string;
  family: string;
  processorName: string;
  cpuArchitecture: string;
  coreCount: number;
  maxFrequency: string;
  operatingVoltage: string;
  packageType: string;
  operatingTemperature: string;
  versionInfo: VKRVersionInfo;
  provenance: ProvenanceInfo;
}

export interface VKRVersionInfo {
  trmRevision?: string;
  datasheetRevision?: string;
  sdkVersion?: string;
  bspVersion?: string;
  importTimestamp: string;
  checksum: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'EXPERIMENTAL';
}

export interface VKRPeripheral {
  name: string;
  baseAddress: string;
  addressBlockSize?: string;
  irq?: number;
  clockDomain?: string;
  busInterface?: string;
  driverName?: string;
  provenance: ProvenanceInfo;
}

export interface VKRRegister {
  peripheralName: string;
  registerName: string;
  offset: string;
  resetValue?: string;
  accessMode?: 'RO' | 'WO' | 'RW';
  description?: string;
  provenance: ProvenanceInfo;
}

export interface VKRMemoryRegion {
  regionName: string;
  startAddress: string;
  endAddress: string;
  sizeBytes: number;
  isExecutable: boolean;
  accessMode: 'RO' | 'RW' | 'RAM' | 'FLASH' | 'MMIO';
  provenance: ProvenanceInfo;
}

export interface VKRMemoryMap {
  processor: string;
  regions: VKRMemoryRegion[];
  pageAlignmentBytes: number;
}

export interface VKRClockDomain {
  domainName: string;
  parentNet?: string;
  nominalFrequencyHz: number;
  sourceType: 'PLL' | 'OSC' | 'DIVIDER';
  provenance: ProvenanceInfo;
}

export interface VKRClockTree {
  processor: string;
  domains: VKRClockDomain[];
}

export interface VKRInterrupt {
  irqNumber: number;
  name: string;
  peripheralBlock: string;
  controllerType: 'GIC' | 'NVIC' | 'INTC';
  triggerType?: 'EDGE_RISING' | 'LEVEL_HIGH';
  provenance: ProvenanceInfo;
}

export interface VKRPinMux {
  pinNumber: string;
  pinName: string;
  signalName: string;
  ioType: string;
  gpioPort?: string;
  gpioBit?: number;
  alternateFunctions?: string[];
  provenance: ProvenanceInfo;
}

export interface VKRDriver {
  driverName: string;
  supportedPeripherals: string[];
  halHeaderFile: string;
  sourceFiles: string[];
  apiFunctions: string[];
  exampleProjects: string[];
  provenance: ProvenanceInfo;
}

export interface VKRBSP {
  linkerScriptTemplate: string;
  startupAssemblyFile: string;
  deviceTreeBinding: string;
  compilationFlags: string[];
  supportedToolchains: string[];
  provenance: ProvenanceInfo;
}

export interface VKRProvenanceLog {
  processor: string;
  importTimestamp: string;
  indexedFiles: string[];
  provenanceEntries: ProvenanceInfo[];
}

export interface VKRValidationReport {
  timestamp: string;
  processor: string;
  passed: boolean;
  missingPeripherals: string[];
  duplicateRegisters: string[];
  memoryOverlaps: string[];
  irqConflicts: string[];
  clockInconsistencies: string[];
  brokenProvenance: string[];
  duplicateSdkVersions: string[];
  invalidJson: string[];
}

export interface VKRSemanticIndex {
  processors: Record<string, string>; // processorName -> vendor/family
  peripherals: Record<string, { vendor: string; family: string; baseAddress: string }>;
  registers: Record<string, { vendor: string; family: string; peripheral: string; offset: string }>;
  addresses: Record<string, { vendor: string; family: string; peripheral: string }>;
  interrupts: Record<number, { vendor: string; family: string; peripheral: string }>;
  pins: Record<string, { vendor: string; family: string; pinName: string }>;
  clockDomains: Record<string, { vendor: string; family: string; frequencyHz: number }>;
  drivers: Record<string, { vendor: string; family: string; headerFile: string }>;
}

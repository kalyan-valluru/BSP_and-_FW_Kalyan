export interface EvidenceItem {
  sourceType: 'SVD' | 'DEVICETREE' | 'TRM' | 'AKEE' | 'ELER' | 'UHKB';
  sourceName: string;
  property: string;
  value: any;
  rankWeight: number; // 1.0 = SVD/DeviceTree, 0.8 = TRM, 0.6 = ELER
}

export interface CanonicalProcessorModel {
  processorId: string;
  vendor: string;
  family: string;
  architecture: string;
  cpuCore: string;
  endianMode: 'little' | 'big';
  hasMMU: boolean;
  hasFPU: boolean;
  peripherals: { id: string; category: string; baseAddress: string; sizeBytes: number; irq?: number }[];
  memoryRegions: { id: string; startAddress: string; sizeBytes: number; permissions: string }[];
  clocks: { id: string; frequencyHz: number }[];
  overallConfidenceScore: number;
  evidenceChain: EvidenceItem[];
  validationStatus: 'VALIDATED' | 'REJECTED';
  timestamp: string;
}

export interface ProcessorStatistics {
  totalProcessorsAdapted: number;
  averageConfidenceScore: number;
  validationRate: number;
  conflictResolutionCount: number;
  vendorDistribution: Record<string, number>;
  architectureDistribution: Record<string, number>;
}

export interface ProcessorAdaptationReport {
  reportId: string;
  timestamp: string;
  processorModel: CanonicalProcessorModel;
  statistics: ProcessorStatistics;
}

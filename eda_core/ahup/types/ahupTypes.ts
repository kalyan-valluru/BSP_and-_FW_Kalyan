export type DocumentClassificationType = 
  | 'device_tree'
  | 'vivado_xsa'
  | 'cmsis_svd'
  | 'pdf_datasheet'
  | 'schematic_image'
  | 'netlist'
  | 'unknown';

export interface FactProvenance {
  documentName: string;
  fileType: DocumentClassificationType;
  pageOrSection?: string;
  confidenceScore: number; // 0.0 to 1.0
  parserUsed: string;
  timestamp: string;
}

export interface ExtractedHardwareFact<T = any> {
  factId: string;
  propertyName: string;
  extractedValue: T | 'UNKNOWN' | 'MISSING';
  provenance: FactProvenance;
}

export interface HardwareUnderstandingReport {
  reportId: string;
  timestamp: string;
  detectedBoard?: ExtractedHardwareFact<string>;
  detectedProcessor?: ExtractedHardwareFact<string>;
  detectedVendor?: ExtractedHardwareFact<string>;
  peripherals: ExtractedHardwareFact<any>[];
  memoryRegions: ExtractedHardwareFact<any>[];
  clocks: ExtractedHardwareFact<any>[];
  interrupts: ExtractedHardwareFact<any>[];
  registers: ExtractedHardwareFact<any>[];
  overallConfidenceScore: number; // 0 to 100%
  missingInformationRequests: string[];
  engineeringWarnings: string[];
  validationSummary?: any;
}

export type SourceType =
  | 'XSA'
  | 'XPR'
  | 'DTS'
  | 'SVD'
  | 'NETLIST'
  | 'SCHEMATIC'
  | 'DATASHEET'
  | 'RAG'
  | 'USER_INPUT'
  | 'AI_INFERENCE'
  | 'UNKNOWN'
  | 'Vision AI'
  | 'RAG (VKR Index)'
  | 'RAG (VKR Local KB)'
  | 'PDF'
  | 'HWH'
  | 'Local KB'
  | 'User';

export type VerificationStatus =
  | 'SOURCE_VERIFIED'
  | 'VENDOR_SOURCE_VERIFIED'
  | 'VALIDATED'
  | 'AI_INFERRED'
  | 'NOT_HARDWARE_VERIFIED'
  | 'REQUIRES_REVIEW'
  | 'CONFLICTING_EVIDENCE'
  | 'SOURCE_MISMATCH';

export interface FieldSourceMeta {
  value: any;
  source_type: SourceType;
  source_document?: string;
  source_identifier?: string;
  extraction_method?: string;
  confidence: number;
  confidence_level?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  validation_status?: VerificationStatus;
  authoritative: boolean;
  ai_inferred: boolean;
  requires_review?: boolean;
}

export interface HardwarePeripheral {
  id: string;
  peripheralBlock: string;
  physicalPinMapping: string;
  clockNetIndicator: boolean;
  baseAddress: string;
  addressType?: 'MMIO' | 'I2C' | 'SPI' | 'MDIO' | 'Logic-Only';
  addressTypeLabel?: string;

  name?: string;
  peripheral?: string;
  source_type?: string;
  // Extended BSP fields
  type?: string;           // GPIO | UART | SPI | I2C | CAN | Ethernet | Timer | ADC | DAC | PWM | USB | SD | QSPI | PCIe | BRAM | DMA
  bus?: string;            // AXI4-Lite | AXI4 | APB | AHB | APB/AHB
  clockSource?: string;    // FCLK0 | s_axi_aclk | PCLK | Internal
  clockFrequency?: string; // e.g. "100 MHz"
  version?: string;        // IP version e.g. "4.0"
  dma?: string;            // "Enabled" | "Disabled"
  operatingMode?: string;  // "Interrupt" | "Polling" | "DMA"
  addressRange?: string;   // e.g. "0x41200000 - 0x41200FFF"
  sourceFile?: string;
  driverName?: string;
  interruptNumber?: number | string;
  status?: 'Active' | 'Inactive' | 'Warning' | 'insufficient_evidence';
  requires_review?: boolean;
  confidence?: number; // percentage, e.g., 95
  deviceAddress?: string;
  spiChipSelect?: number | string;
  gpioNumber?: number | string;
  originalAddress?: string;
  correctedAddress?: string;
  provenanceSource?: string;
  verification_status?: VerificationStatus;
  // Provenance metadata fields per field
  baseAddress_meta?: FieldSourceMeta;
  interruptNumber_meta?: FieldSourceMeta;
  clockSource_meta?: FieldSourceMeta;
  driverName_meta?: FieldSourceMeta;
  physicalPinMapping_meta?: FieldSourceMeta;
  bus_meta?: FieldSourceMeta;
  dma_meta?: FieldSourceMeta;
  // Reasoning Layer & Traceability Metadata
  confidenceScore?: number;
  detectionSource?: string[];
  supportingEvidence?: string[];
  reasoning?: string;
  validationStatus?: 'PASS' | 'WARNING' | 'FAIL';
  traceability?: {
    generatedByRule?: string;
    approvedByValidator?: string;
    documentSource?: string;
    timestamp?: string;
  };
  fieldStatuses?: {
    baseAddress?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
    interruptNumber?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
    clockSource?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
    dma?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
    driverName?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
    bus?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
    physicalPinMapping?: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved';
  };
}

export interface ReviewQueueItem {
  id: string;
  peripheralBlock: string;
  field: string;
  suggestedValue: string;
  confidence: number;
  evidence: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PlatformPreset {
  id: string;
  name: string;
  vendor: string;
  boardName?: string;
  boardPreset?: string;
  logoType: 'xilinx' | 'ti' | 'st' | 'nvidia' | 'samsung' | 'nxp';
  architecture: string;
  frequency: string;
  peripherals: HardwarePeripheral[];
  bareMetalCode: string;
  deviceTreeCode: string;
  memoryType?: string;
  clockSource?: string;
  resetController?: string;
  interruptController?: string;
  axiInterconnect?: string;
  bootDevice?: string;
  operatingSystems?: string[];
  vivadoVersion?: string;
  vitisVersion?: string;
  workflow?: string[];
  inputFiles?: string[];
  generatedArtifacts?: string[];
  toolchainUsed?: string;
  supportedFlow?: 'Bare Metal' | 'Linux' | 'Both';
}

export interface AppState {
  lockStatus: 'unlocked' | 'frozen';
  uploadedFiles: File[];
  activePreset: PlatformPreset | null;
  peripherals: HardwarePeripheral[];
  geminiToken: string;
  selectedModel: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  activeCodeTab: 'bareMetal' | 'deviceTree';
  terminalOutput: TerminalLine[];
  compilationStatus: 'idle' | 'running' | 'error' | 'success';
}

export interface TerminalLine {
  id: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'system';
  content: string;
  timestamp: Date;
  stageId?: string;
  stageStatus?: 'running' | 'completed' | 'failed';
}

export interface ValidationCheck {
  id: string;
  name: string;
  category?: string;
  severity: 'Critical' | 'Error' | 'Warning' | 'Info' | string;
  passed: boolean;
  detail: string;
  recommendation?: string;
}

export interface ValidationReport {
  overallStatus: 'PASS' | 'WARNING' | 'FAIL';
  readinessScore: number;
  checks: ValidationCheck[];
}

export interface DecisionLogEntry {
  source: string;
  page?: string | number;
  field: string;
  value: string;
  reason: string;
  artifact?: string;
}

export interface ConfidenceReport {
  overallConfidence: number;
  fieldConfidenceMap?: Record<string, number>;
}


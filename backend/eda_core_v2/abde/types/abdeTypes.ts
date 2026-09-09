export interface BoardComponent {
  componentId: string;
  category: 'CPU' | 'DDR' | 'QSPI_FLASH' | 'ETHERNET_PHY' | 'PMIC' | 'OSCILLATOR' | 'GPIO_EXPANDER';
  mpn: string; // Manufacturer Part Number
  manufacturer: string;
  interfaceBus: string;
  baseAddress?: string;
}

export interface BoardTopology {
  powerDomains: { railName: string; voltageV: number; sourceComponentId: string }[];
  clockSources: { clockName: string; frequencyHz: number; sourceComponentId: string }[];
  resetTopology: { resetName: string; activeLow: boolean }[];
  memoryMap: { regionName: string; startAddress: string; sizeBytes: number }[];
  peripheralMap: { peripheralId: string; componentId: string }[];
}

export interface CanonicalBoardModel {
  boardId: string;
  boardName: string;
  boardFamily: string;
  revision: string;
  vendor: string;
  processorId: string;
  components: BoardComponent[];
  topology: BoardTopology;
  overallConfidenceScore: number;
  validationStatus: 'VALIDATED' | 'REJECTED';
  timestamp: string;
}

export interface BoardStatistics {
  totalBoardsDiscovered: number;
  averageConfidenceScore: number;
  topologyCompletenessScore: number; // 0 - 100%
  validationRate: number;
  vendorDistribution: Record<string, number>;
  componentCategoryDistribution: Record<string, number>;
}

export interface BoardDiscoveryReport {
  reportId: string;
  timestamp: string;
  boardModel: CanonicalBoardModel;
  statistics: BoardStatistics;
}

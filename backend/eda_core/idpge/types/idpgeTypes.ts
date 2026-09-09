export interface GeneratedDriverFile {
  filename: string;
  relativePath: string;
  content: string;
  checksumSha256: string;
  category: 'UART' | 'GPIO' | 'SPI' | 'I2C' | 'ETH' | 'DMA' | 'INTC' | 'INIT' | 'MANIFEST';
}

export interface DriverManifest {
  manifestVersion: string;
  generatorVersion: string;
  targetProcessorId: string;
  timestamp: string;
  driversCount: number;
  drivers: { name: string; category: string; filename: string; checksum: string }[];
  supportedOS: string[];
  supportedToolchains: string[];
  validationStatus: any;
}

export interface DriverGenerationReport {
  reportId: string;
  timestamp: string;
  targetProcessor: string;
  generatedDrivers: GeneratedDriverFile[];
  manifest: DriverManifest;
  overallReadinessScore: number;
  validationSummary: any;
  generationTimeMs: number;
}

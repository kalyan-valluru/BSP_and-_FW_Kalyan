export interface MemorySectionDefinition {
  name: string; // .text, .data, .bss, .rodata, .heap, .stack
  targetRegion: 'FLASH' | 'SRAM' | 'DDR' | 'OCRAM';
  alignmentBytes: number;
  permissions: 'rx' | 'rw' | 'rwx';
}

export interface GeneratedMemoryFile {
  filename: string;
  relativePath: string;
  content: string;
  checksumSha256: string;
  category: 'STARTUP' | 'VECTORS' | 'LINKER' | 'HEADER' | 'ALLOCATOR' | 'MANIFEST';
}

export interface MemoryManifest {
  manifestVersion: string;
  generatorVersion: string;
  targetProcessorId: string;
  coreArchitecture: string;
  timestamp: string;
  memoryRegions: { name: string; startHex: string; sizeBytes: number }[];
  sections: MemorySectionDefinition[];
  stackSizeBytes: number;
  heapSizeBytes: number;
  validationStatus: any;
}

export interface StartupGenerationReport {
  reportId: string;
  timestamp: string;
  targetProcessor: string;
  coreArchitecture: string;
  generatedMemoryFiles: GeneratedMemoryFile[];
  manifest: MemoryManifest;
  overallReadinessScore: number;
  validationSummary: any;
  generationTimeMs: number;
}

export interface GeneratedArtifactFile {
  filename: string;
  relativePath: string;
  content: string;
  checksumSha256: string;
  language: 'c' | 'assembly' | 'header' | 'devicetree' | 'linker' | 'makefile' | 'json' | 'markdown';
}

export interface GenerationManifest {
  manifestVersion: string;
  generatorVersion: string;
  targetProcessorId: string;
  targetBoardId: string;
  targetOS: string;
  timestamp: string;
  generatedFilesCount: number;
  files: { filename: string; sizeBytes: number; checksum: string }[];
  validationStatus: any;
}

export interface BSPGenerationReport {
  reportId: string;
  timestamp: string;
  targetProcessor: string;
  targetOS: string;
  generatedArtifacts: GeneratedArtifactFile[];
  manifest: GenerationManifest;
  overallReadinessScore: number;
  validationSummary: any;
  generationTimeMs: number;
}

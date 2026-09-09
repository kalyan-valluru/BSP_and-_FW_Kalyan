export interface ProjectFileEntry {
  filename: string;
  relativePath: string; // e.g. "src/main.c", "drivers/uart.c", "CMakeLists.txt"
  content: string;
  checksumSha256: string;
  category: 'SOURCE' | 'HEADER' | 'DRIVER' | 'STARTUP' | 'LINKER' | 'DEVICETREE' | 'BUILD_SCRIPT' | 'MANIFEST' | 'DOC';
}

export interface ProjectManifest {
  manifestVersion: string;
  generatorVersion: string;
  projectName: string;
  targetProcessorId: string;
  targetBoardId: string;
  targetOS: string;
  toolchain: string;
  timestamp: string;
  filesCount: number;
  files: { relativePath: string; checksum: string }[];
  validationStatus: any;
}

export interface BuildProjectReport {
  reportId: string;
  timestamp: string;
  projectName: string;
  targetProcessor: string;
  targetOS: string;
  projectTree: ProjectFileEntry[];
  manifest: ProjectManifest;
  overallReadinessScore: number;
  validationSummary: any;
  assemblyTimeMs: number;
}

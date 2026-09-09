export interface ToolchainInfo {
  id: string;
  name: string;
  executable: string;
  version: string;
  isAvailable: boolean;
  installPath?: string;
}

export interface BuildExecutionPlan {
  planId: string;
  targetProcessorId: string;
  toolchain: ToolchainInfo;
  compilerFlags: string[];
  linkerFlags: string[];
  sources: string[];
  includeDirectories: string[];
  outputDirectory: string;
  executionCommands: string[];
}

export interface CompiledArtifact {
  filename: string;
  relativePath: string;
  type: 'ELF' | 'BIN' | 'HEX' | 'MAP' | 'DTB' | 'DTS';
  sizeBytes: number;
  checksumSha256: string;
}

export interface CompilationResult {
  buildId: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNINGS' | 'FAILED' | 'BLOCKED';
  exitCode: number;
  buildDurationMs: number;
  stdout: string;
  stderr: string;
  warnings: string[];
  errors: string[];
  artifacts: CompiledArtifact[];
}

export interface BuildManifest {
  manifestVersion: string;
  generatorVersion: string;
  targetProcessorId: string;
  toolchainName: string;
  compilerVersion: string;
  timestamp: string;
  status: string;
  artifactsCount: number;
  artifacts: { filename: string; sizeBytes: number; checksum: string }[];
  buildDurationMs: number;
}

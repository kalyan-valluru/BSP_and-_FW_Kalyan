export type FailureCategory = 'COMPILER_ERROR' | 'LINKER_ERROR' | 'ENVIRONMENT_ERROR' | 'DEPENDENCY_ERROR' | 'NONE';

export interface CapturedExecutionArtifact {
  filename: string;
  relativePath: string;
  type: 'ELF' | 'BIN' | 'HEX' | 'MAP' | 'DTB';
  sizeBytes: number;
  checksumSha256: string;
}

export interface NormalizedExecutionResult {
  executionId: string;
  timestamp: string;
  toolchainName: string;
  status: 'SUCCESS' | 'WARNINGS' | 'FAILED';
  failureCategory: FailureCategory;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  warningsCount: number;
  errorsCount: number;
  artifacts: CapturedExecutionArtifact[];
}

export interface ExecutionManifest {
  manifestVersion: string;
  generatorVersion: string;
  executionId: string;
  toolchainName: string;
  timestamp: string;
  status: string;
  failureCategory: FailureCategory;
  commandsExecuted: string[];
  artifacts: { filename: string; sizeBytes: number; checksum: string }[];
  durationMs: number;
}

export interface BuildExecutionReport {
  reportId: string;
  timestamp: string;
  targetProcessor: string;
  toolchainName: string;
  normalizedResult: NormalizedExecutionResult;
  manifest: ExecutionManifest;
  executionTimeMs: number;
}

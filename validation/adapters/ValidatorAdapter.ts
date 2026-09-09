/**
 * ValidatorAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-Grade Universal Validation Engine Interface and Models
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ValidationCategory =
  | 'HardwareDRC'
  | 'DeviceTree'
  | 'Compilation'
  | 'StaticAnalysis'
  | 'Runtime';

export type StageExecutionStatus =
  | 'PASSED'
  | 'FAILED'
  | 'SKIPPED'
  | 'TOOL_NOT_INSTALLED'
  | 'NOT_APPLICABLE';

export type ExecutionMode =
  | 'DETERMINISTIC_EXECUTION'
  | 'DETERMINISTIC_FALLBACK'
  | 'SYNTHETIC_SANDBOX'
  | 'SKIPPED'
  | 'NOT_INSTALLED';

export type ValidationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface ValidationArtifact {
  name: string;
  path: string;
  type: 'dts' | 'dtb' | 'elf' | 'log' | 'report' | 'source' | 'json';
  sourceModule?: string;
  generationStage?: string;
  generationTimestamp?: string;
  dependencies?: string[];
}

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: string;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  codeSnippet?: string;
  recommendation?: string;
}

export interface ToolExecutionDetails {
  name: string;
  version?: string;
  executablePath?: string;
  commandExecuted?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface ValidatorResult {
  adapterId: string;
  adapterName: string;
  category: ValidationCategory;
  status: StageExecutionStatus;
  executionMode: ExecutionMode;
  confidence: ValidationConfidence;
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  executionTimeMs: number;
  toolInfo?: ToolExecutionDetails;
  issues: ValidationIssue[];
  rawOutput: string;
  artifacts: ValidationArtifact[];
  summaryMetrics?: Record<string, number | string | boolean>;
}

export interface ValidationContext {
  sessionId: string;
  platformId: string;
  platformName: string;
  vendor: string;
  architecture: string;
  targetFlow: 'bare_metal' | 'linux' | 'both';
  workspaceDir: string;
  sourceFiles?: {
    dtsPath?: string;
    cSourcePaths?: string[];
    headerPaths?: string[];
    elfPath?: string;
    svdPath?: string;
  };
  peripherals?: any[];
  allowSimulatedFallbacks?: boolean;
}

export interface ValidatorAdapter {
  id: string;
  name: string;
  category: ValidationCategory;
  
  /**
   * Evaluates if this validator can run given the current validation context & artifacts.
   */
  canRun(context: ValidationContext): boolean;

  /**
   * Executes validation and returns normalized results with full tool details.
   */
  validate(context: ValidationContext): Promise<ValidatorResult>;
}

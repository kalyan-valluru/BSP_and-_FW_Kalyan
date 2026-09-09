import { LogType, CompilationResult } from './vitisBridge';
import { HardwareModelMetadata } from './toolchainResolver';
import { HardwareAbstractionLayer } from './hal';

export interface BuildContext {
  sessionId: string;
  presetId: string;
  bareMetalCode: string;
  deviceTreeCode: string;
  peripherals: any[];
  uploadedFileNames: string[];
  targetFlow: 'bare_metal' | 'linux' | 'both';
  metadata: HardwareModelMetadata;
  workspace: string; // Base session directory: workspace/generated/projects/<sessionId>
  onLog: (type: LogType, line: string) => void;
  signal?: AbortSignal;
  state: Record<string, any>;
}

export interface FeasibilityReport {
  feasible: boolean;
  criticalIssues: string[];
  recommendedWarnings: string[];
  optionalNotes: string[];
}

export interface ValidationSummary {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PlatformAdapter extends HardwareAbstractionLayer {
  validateHardware(ctx: BuildContext): Promise<FeasibilityReport>;
  generateProject(ctx: BuildContext): Promise<boolean>;
  build(ctx: BuildContext): Promise<CompilationResult>;
  validateArtifacts(ctx: BuildContext): Promise<ValidationSummary>;
  generateReports(ctx: BuildContext): Promise<void>;
}

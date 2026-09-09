import { StageResult } from './models/ValidationResult';
import { ProposedFixPatch } from './AutoRecoveryEngine';

export interface PluginDetectionResult {
  toolName: string;
  installed: boolean;
  version?: string;
  path?: string;
  impactIfMissing: string;
}

export interface ValidationPlugin {
  id: string;
  name: string;

  /**
   * Detects whether the tool executable or required environment is installed on the host.
   */
  detect(): Promise<PluginDetectionResult>;

  /**
   * Performs validation or compilation on the target context.
   */
  validate(context: any): Promise<StageResult>;

  /**
   * Performs analysis and diagnostic categorization on the output artifacts or logs.
   */
  analyze(context: any): Promise<StageResult>;

  /**
   * Suggests or executes recovery actions for categorized issues.
   */
  recover(stageResult: StageResult, context: any): Promise<ProposedFixPatch[]>;

  /**
   * Produces a structured report segment or summary for this plugin.
   */
  report(stageResult: StageResult): string;
}

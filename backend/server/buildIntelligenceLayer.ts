import fs from 'fs/promises';
import path from 'path';
import { BuildContext } from './platformAdapter';
import { classifyVivadoOutput, VivadoClassification } from './buildDiagnostics';
import { LogType } from './vitisBridge';

// ─── Build Outcome Enum ───────────────────────────────────────────────────────

export enum BuildOutcome {
  SUCCESS = 'SUCCESS',
  SUCCESS_WITH_WARNINGS = 'SUCCESS_WITH_WARNINGS',
  RECOVERABLE_FAILURE = 'RECOVERABLE_FAILURE',
  FATAL_FAILURE = 'FATAL_FAILURE',
}

// ─── Stage Diagnostic Entry ───────────────────────────────────────────────────

export interface StageDiagnostic {
  stage: string;
  timestamp: string;
  outcome: BuildOutcome;
  exitCode: number;
  durationMs: number;
  warnings: string[];
  errors: string[];
  generatedArtifacts: string[];
  repairInvoked: boolean;
  repairSuccessful: boolean;
  retryCount: number;
  details?: string;
}

// ─── Deterministic Infrastructure Failure Patterns ────────────────────────────

const INFRASTRUCTURE_FATAL_PATTERNS: RegExp[] = [
  /vivado.*not\s+found|vivado.*not\s+installed/i,
  /xsct.*not\s+found|xsct.*not\s+installed/i,
  /arm-none-eabi.*not\s+found|aarch64-none-elf.*not\s+found/i,
  /command\s+not\s+found|is\s+not\s+recognized\s+as\s+an\s+internal\s+or\s+external\s+command/i,
  /permission\s+denied|access\s+is\s+denied/i,
  /no\s+space\s+left\s+on\s+device|disk\s+full/i,
  /process\s+killed|killed\s+by\s+signal|sigkill/i,
  /license\s+error|license\s+checkout\s+failed|no\s+license/i,
  /out\s+of\s+memory|system\s+memory\s+exceeded/i,
];

// ─── Build Intelligence Layer Class ──────────────────────────────────────────

export class BuildIntelligenceLayer {
  private stageDiagnostics: StageDiagnostic[] = [];

  /**
   * Evaluates a stage execution deterministically using process exit code,
   * stdout/stderr log classification, and artifact existence.
   */
  async evaluateStage(
    stage: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    durationMs: number,
    expectedArtifacts: string[],
    ctx: BuildContext
  ): Promise<{
    outcome: BuildOutcome;
    classification: VivadoClassification;
    existingArtifacts: string[];
    missingArtifacts: string[];
    isInfrastructureFatal: boolean;
  }> {
    const classification = classifyVivadoOutput(stdout, stderr, exitCode);

    // Check artifact existence deterministically on disk
    const existingArtifacts: string[] = [];
    const missingArtifacts: string[] = [];

    for (const artPath of expectedArtifacts) {
      if (!artPath) continue;
      try {
        await fs.access(artPath);
        existingArtifacts.push(artPath);
      } catch {
        missingArtifacts.push(artPath);
      }
    }

    const allExpectedPresent = expectedArtifacts.length > 0 && missingArtifacts.length === 0;

    // Check for deterministic infrastructure failures (no AI invocation allowed)
    const isInfrastructureFatal = classification.errors.some(err =>
      INFRASTRUCTURE_FATAL_PATTERNS.some(p => p.test(err))
    );

    let outcome: BuildOutcome;

    if (isInfrastructureFatal) {
      outcome = BuildOutcome.FATAL_FAILURE;
    } else if (exitCode === 0 && classification.errors.length === 0 && classification.warnings.length === 0) {
      outcome = BuildOutcome.SUCCESS;
    } else if ((exitCode === 0 || allExpectedPresent) && classification.errors.length === 0) {
      // Artifact-based validation: if key artifacts exist, classify as SUCCESS_WITH_WARNINGS
      outcome = BuildOutcome.SUCCESS_WITH_WARNINGS;
    } else if (allExpectedPresent && classification.errors.length > 0 && !classification.isFatal) {
      // Vivado emitted error text but successfully generated all required artifacts (.xsa, .bit, BD, etc.)
      ctx.onLog('warning', `[BUILD INTELLIGENCE] [${stage}] Vivado reported log errors but generated all required artifacts (${existingArtifacts.map(a => path.basename(a)).join(', ')}). Classifying stage as SUCCESS_WITH_WARNINGS.`);
      outcome = BuildOutcome.SUCCESS_WITH_WARNINGS;
    } else if (exitCode !== 0 || missingArtifacts.length > 0) {
      outcome = BuildOutcome.RECOVERABLE_FAILURE;
    } else {
      outcome = BuildOutcome.SUCCESS_WITH_WARNINGS;
    }

    return {
      outcome,
      classification,
      existingArtifacts,
      missingArtifacts,
      isInfrastructureFatal,
    };
  }

  recordDiagnostic(diag: StageDiagnostic): void {
    this.stageDiagnostics.push(diag);
  }

  getDiagnostics(): StageDiagnostic[] {
    return [...this.stageDiagnostics];
  }

  async saveDiagnosticsReport(reportsDir: string): Promise<void> {
    try {
      await fs.mkdir(reportsDir, { recursive: true });
      const reportPath = path.join(reportsDir, 'stage_diagnostics.json');
      await fs.writeFile(reportPath, JSON.stringify(this.stageDiagnostics, null, 2), 'utf-8');
    } catch {
      // Ignore report write error
    }
  }
}

export const buildIntelligenceLayer = new BuildIntelligenceLayer();

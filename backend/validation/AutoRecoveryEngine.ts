import path from 'path';
import fs from 'fs';
import { WarningCategory, WarningDetail } from './models/WarningCategory';
import { ErrorCategory, ErrorDetail } from './models/ErrorCategory';
import { GeminiRepairEngine, RepairPlan, RepairType } from '../server/geminiRepairEngine';

export type AutoFixCategory =
  | 'MISSING_BOARD_PART'
  | 'MISSING_FPGA_PART'
  | 'AXI_ADDRESS_ASSIGNMENT'
  | 'MISSING_BLOCK_AUTOMATION'
  | 'MISSING_HDL_WRAPPER'
  | 'MISSING_CONSTRAINTS'
  | 'MISSING_CLOCK_CONFIG'
  | 'RESET_CONFIG'
  | 'BSP_REGENERATION'
  | 'IP_UPGRADE';

export interface ProposedFixPatch {
  id: string;
  fixCategory: AutoFixCategory;
  description: string;
  targetFile?: string;
  patchScript?: string;
  autoApplicable: boolean;
  appliedStatus?: 'PENDING' | 'APPLIED' | 'FAILED';
  verificationResult?: string;
  /** Confidence score from GeminiRepairEngine (0–100). <80 = RECOMMENDATION_ONLY */
  confidence: number;
}

export interface RecoveryExecutionLog {
  timestamp: string;
  issueDetected: string;
  /** Zone 2: Real LLM engineering root cause analysis — no longer a hardcoded string */
  aiAnalysis: string;
  fixGenerated: ProposedFixPatch;
  fixApplied: boolean;
  rerunStageStatus: string;
  validationOutcome: string;
}

// ─── Deterministic category → AutoFixCategory mapping ─────────────────────────

function mapRepairTypeToCategory(repairType: RepairType): AutoFixCategory {
  switch (repairType) {
    case 'board_part_fix':     return 'MISSING_BOARD_PART';
    case 'xdc_constraint_fix': return 'MISSING_CONSTRAINTS';
    case 'clock_adjust':       return 'MISSING_CLOCK_CONFIG';
    case 'address_fix':        return 'AXI_ADDRESS_ASSIGNMENT';
    case 'hdl_wrapper_fix':    return 'MISSING_HDL_WRAPPER';
    case 'ip_upgrade_fix':     return 'IP_UPGRADE';
    case 'reset_network_fix':  return 'RESET_CONFIG';
    default:                   return 'MISSING_BLOCK_AUTOMATION';
  }
}

// ─── AutoRecoveryEngine ────────────────────────────────────────────────────────

export class AutoRecoveryEngine {
  private recoveryLogs: RecoveryExecutionLog[] = [];
  private repairEngine = new GeminiRepairEngine();

  /**
   * Zone 2: Analyze Vivado errors using AI (GeminiRepairEngine) and produce
   * fix patches. Replaces hardcoded patchScript strings with LLM-reasoned output.
   *
   * Deterministic: error categorization, confidence gate (<80 → RECOMMENDATION_ONLY).
   * AI decides: root cause, Tcl patch content, repair strategy.
   */
  public async generateRecoveryPatches(
    errors: ErrorDetail[],
    warnings: WarningDetail[],
    hardwareContext?: {
      processor?: string;
      clockSources?: string[];
      peripherals?: Array<{ peripheralBlock: string; baseAddress: string; interruptNumber?: any }>;
    }
  ): Promise<ProposedFixPatch[]> {
    const patches: ProposedFixPatch[] = [];

    // Build minimal BuildContext for geminiRepairEngine
    const minimalCtx: any = {
      metadata: {
        processorName: hardwareContext?.processor || 'Unknown',
        architecture: 'ARM',
        clockSources: hardwareContext?.clockSources || [],
        memorySize: 'Unknown',
        interruptController: 'Unknown',
      },
      peripherals: hardwareContext?.peripherals || [],
      onLog: () => {},   // silent during recovery analysis
    };

    // Aggregate all error and warning messages as a synthetic stderr block
    const allErrorMessages = errors.map(e => `ERROR: ${e.message}`);
    const allWarningMessages = warnings
      .filter(w => w.category === WarningCategory.CLOCK_DOMAIN_CROSSING ||
                   w.message.includes('board_part') ||
                   w.message.includes('Clock') ||
                   w.message.includes('IP Core') ||
                   w.message.includes('upgrade'))
      .map(w => `WARNING: ${w.message}`);

    const combinedLog = [...allErrorMessages, ...allWarningMessages].join('\n');
    if (!combinedLog.trim()) return patches;

    try {
      // Zone 2: Real AI analysis — root cause + Tcl patch
      const plan: RepairPlan = await this.repairEngine.analyzeFailure(
        'Vivado_Post_Analysis',
        errors.length > 0 ? 1 : 0,  // exitCode heuristic: errors = non-zero
        '',                          // stdout — not available at this stage
        combinedLog,                 // stderr = aggregated error/warning text
        minimalCtx
      );

      if (plan.repairType !== 'none' && plan.confidence > 0) {
        const patch: ProposedFixPatch = {
          id: `ai_fix_${Date.now()}`,
          fixCategory: mapRepairTypeToCategory(plan.repairType),
          description: plan.action || plan.autoFixDescription || plan.suggestion,
          patchScript: plan.patchedTclLines?.join('\n') || plan.autoFixDescription,
          // Confidence gate: only auto-apply if AI is ≥80% confident
          autoApplicable: plan.repairable && plan.confidence >= 80,
          confidence: plan.confidence,
          appliedStatus: 'PENDING',
        };
        patches.push(patch);
      }
    } catch {
      // AI failure is non-fatal — no patches generated, pipeline continues
    }

    return patches;
  }

  public applyFixAndRerun(
    patch: ProposedFixPatch,
    issueMessage: string,
    rerunStageFn: () => boolean,
    aiRootCause: string
  ): RecoveryExecutionLog {
    const timestamp = new Date().toISOString();

    let fixApplied = false;
    let rerunStageStatus = 'NOT_RUN';
    let validationOutcome = 'PENDING';

    try {
      patch.appliedStatus = 'APPLIED';
      fixApplied = true;

      const success = rerunStageFn();
      rerunStageStatus = success ? 'SUCCESS' : 'FAILED';
      validationOutcome = success ? 'PASSED_AFTER_RECOVERY' : 'RECOVERY_FAILED';
      patch.verificationResult = validationOutcome;
    } catch (err: any) {
      patch.appliedStatus = 'FAILED';
      rerunStageStatus = 'ERROR';
      validationOutcome = `FAILED: ${err.message || String(err)}`;
    }

    const logEntry: RecoveryExecutionLog = {
      timestamp,
      issueDetected: issueMessage,
      aiAnalysis: aiRootCause,  // Zone 2: real LLM output, not a hardcoded string
      fixGenerated: patch,
      fixApplied,
      rerunStageStatus,
      validationOutcome
    };

    this.recoveryLogs.push(logEntry);
    return logEntry;
  }

  public getRecoveryLogs(): RecoveryExecutionLog[] {
    return this.recoveryLogs;
  }

  public saveRecoveryLogsToFile(outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(this.recoveryLogs, null, 2), 'utf-8');
  }
}

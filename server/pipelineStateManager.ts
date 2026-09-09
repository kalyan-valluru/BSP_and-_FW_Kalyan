import { LogType } from './vitisBridge';

// ─── Pipeline State Enum ──────────────────────────────────────────────────────
export type PipelineState =
  | 'Running'
  | 'WarningDetected'
  | 'AIRepairing'
  | 'Retrying'
  | recovered_state
  | 'Failed';

// Use string literal to avoid collision with TS keywords
type recovered_state = 'Recovered';

export const PipelineStates = {
  Running: 'Running' as PipelineState,
  WarningDetected: 'WarningDetected' as PipelineState,
  AIRepairing: 'AIRepairing' as PipelineState,
  Retrying: 'Retrying' as PipelineState,
  Recovered: 'Recovered' as PipelineState,
  Failed: 'Failed' as PipelineState,
};

// ─── Stage Result ─────────────────────────────────────────────────────────────
export interface StageResult {
  stageName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  warnings: string[];
  errors: string[];
  isFatal: boolean;
}

// ─── Pipeline State Manager ───────────────────────────────────────────────────
export class PipelineStateManager {
  private currentState: PipelineState = PipelineStates.Running;
  private sessionId: string;
  private onLog: (type: LogType, line: string) => void;
  private collectedWarnings: string[] = [];
  private retryCount: number = 0;

  constructor(sessionId: string, onLog: (type: LogType, line: string) => void) {
    this.sessionId = sessionId;
    this.onLog = onLog;
  }

  getState(): PipelineState {
    return this.currentState;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  getCollectedWarnings(): string[] {
    return [...this.collectedWarnings];
  }

  addWarning(warning: string): void {
    this.collectedWarnings.push(warning);
  }

  /**
   * Transition to a new state and emit a structured log line that the SSE
   * client and frontend can parse using the `[PIPELINE STATE]` prefix.
   */
  transition(newState: PipelineState, detail?: string): void {
    const prev = this.currentState;
    this.currentState = newState;

    const msg = detail
      ? `[PIPELINE STATE] ${newState} | ${detail}`
      : `[PIPELINE STATE] ${newState}`;

    const logType: LogType =
      newState === 'Failed' ? 'error' :
      newState === 'WarningDetected' ? 'warning' :
      newState === 'AIRepairing' ? 'system' :
      newState === 'Retrying' ? 'system' :
      newState === 'Recovered' ? 'success' :
      'system';

    this.onLog(logType, msg);

    if (newState === 'Retrying') {
      this.retryCount++;
    }
  }

  /**
   * Emit a warning notification without changing state (used when in Running
   * state and a non-fatal warning is detected mid-stage).
   */
  emitWarningDiagnostic(stage: string, warning: string): void {
    this.addWarning(warning);
    this.onLog('warning', `[PIPELINE DIAGNOSTIC] [${stage}] ${warning}`);
  }

  /**
   * Emit a repair suggestion from the AI engine as a structured log line.
   */
  emitRepairSuggestion(diagnosis: string, suggestion: string): void {
    this.onLog('system', `[PIPELINE REPAIR] Diagnosis: ${diagnosis}`);
    this.onLog('system', `[PIPELINE REPAIR] Suggestion: ${suggestion}`);
  }

  /**
   * Emit a summary of all collected warnings at the end of a successful build.
   * This surfaces non-fatal issues as diagnostics rather than hiding them.
   */
  emitWarningSummary(): void {
    if (this.collectedWarnings.length === 0) return;
    this.onLog('warning', `[PIPELINE SUMMARY] ${this.collectedWarnings.length} non-fatal warning(s) collected during build:`);
    for (const w of this.collectedWarnings) {
      this.onLog('warning', `  ⚠ ${w}`);
    }
  }
}

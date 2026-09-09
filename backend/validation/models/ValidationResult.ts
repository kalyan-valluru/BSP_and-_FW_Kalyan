import { ErrorDetail } from './ErrorCategory';
import { WarningDetail } from './WarningCategory';
import { ExecutiveSummary } from '../../server/ai/engineeringAdvisor';

export interface ResourceEstimate {
  luts?: number;
  flipFlops?: number;
  brams?: number;
  dsps?: number;
  totalCells?: number;
  rawCellCounts?: Record<string, number>;
  estimatedMaxFreqMHz?: number;
}

export interface TimingAnalysisSummary {
  worstNegativeSlackNs: number; // Worst Slack (WNS)
  totalNegativeSlackNs: number; // Total Negative Slack (TNS)
  criticalPath: string;         // e.g. "UART → AXI → GPIO"
  estimatedMaxFreqMHz: number;  // Estimated Maximum Frequency (Fmax)
  totalViolations: number;      // Number of timing violations
  timingMet: boolean;           // Slack >= 0
  formattedAiSummary: string;   // Clean formatted AI timing summary
}

export interface AiDiagnosticRecommendation {
  summary: string;
  explanation: string;
  suggestedFixes: Array<{
    title: string;
    description: string;
    patch?: string;
    targetFile?: string;
  }>;
}

export interface StageResult {
  stageName: string;
  toolName: string;
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  executionTimeMs: number;
  errors: ErrorDetail[];
  warnings: WarningDetail[];
  resourceEstimate?: ResourceEstimate;
  timingSummary?: TimingAnalysisSummary;
  aiRecommendation?: AiDiagnosticRecommendation;
  outputArtifacts: Array<{
    name: string;
    path: string;
    type: string;
  }>;
}

export interface ToolCapability {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  supportedStages: string[];
}

export interface ValidationReportSummary {
  timestamp: string;
  sessionId: string;
  overallSuccess: boolean;
  totalStagesRun: number;
  passedStages: number;
  failedStages: number;
  skippedStages: number;
  totalErrors: number;
  totalWarnings: number;
  toolAvailability: ToolCapability[];
  stageResults: StageResult[];
  aggregateResourceEstimate?: ResourceEstimate;
  aiRecoverySummary?: string;
  /** Zone 5: AI-generated engineering executive summary — absent if AI unavailable */
  aiExecutiveSummary?: ExecutiveSummary;
}

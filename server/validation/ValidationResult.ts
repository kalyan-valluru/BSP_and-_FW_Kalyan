/**
 * ValidationResult.ts
 * Immutably defines the Commercial EDA-Grade Validation Result Schema.
 * Used as single source of truth across Backend, API, UI, and PDF reporting.
 */

export type MandatoryGateId =
  | 'PROJECT_CREATION'
  | 'RTL_GENERATION'
  | 'SYNTHESIS'
  | 'IMPLEMENTATION'
  | 'BITSTREAM'
  | 'XSA_EXPORT'
  | 'BSP_GENERATION'
  | 'FIRMWARE_COMPILATION';

export type GateStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface MandatoryGate {
  id: MandatoryGateId;
  name: string;
  status: GateStatus;
  evidence?: string;
  exitCode?: number;
}

export type DeploymentState = 'FAILED' | 'BUILDABLE' | 'VALIDATED' | 'PRODUCTION_READY';

export type EngineeringGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'FAILED';

export type WarningSeverity = 'INFO' | 'WARNING' | 'CRITICAL_WARNING' | 'ERROR';
export type WarningImpact = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKER';
export type WarningAutoFix = 'YES' | 'NO' | 'PARTIAL';

export interface ClassifiedWarning {
  id: string;
  code?: string;
  message: string;
  severity: WarningSeverity;
  impact: WarningImpact;
  autoFix: WarningAutoFix;
  sourceTool: 'Vivado' | 'Vitis' | 'GCC' | 'BSP' | 'DRC' | 'System';
  penalty: number;
}

export interface QualityCategoryMetric {
  id: string;
  name: string;
  maxScore: number;
  score: number;
  details: string;
  passed: boolean;
}

export interface QualityMetrics {
  hardwareCompleteness: QualityCategoryMetric; // 15%
  vivadoDrcQuality: QualityCategoryMetric;     // 20%
  driverCompleteness: QualityCategoryMetric;   // 15%
  memoryMap: QualityCategoryMetric;            // 10%
  interruptMapping: QualityCategoryMetric;     // 10%
  clockConfiguration: QualityCategoryMetric;   // 10%
  documentation: QualityCategoryMetric;        // 10%
  resourceEfficiency: QualityCategoryMetric;   // 10%
  totalQualityScore: number;                   // 0–100%
  penaltiesApplied: number;
}

export interface ValidationSummary {
  readinessScore: number; // 0-100%
  grade: EngineeringGrade;
  deploymentState: DeploymentState;
  mandatoryGatesPassed: number;
  totalMandatoryGates: number;
  criticalErrors: number;
  totalWarnings: number;
  autoFixedWarnings: number;
  buildStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'NOT_STARTED';
  bitstreamStatus: 'Generated' | 'Not Generated' | 'Failed';
  xsaStatus: 'Generated' | 'Not Generated' | 'Failed';
  bspStatus: 'Generated' | 'Not Generated' | 'Failed';
  firmwareStatus: 'Compiled' | 'Not Compiled' | 'Failed';
  targetFlow: 'bare_metal' | 'linux' | 'both';
}

export interface ValidationResult {
  timestamp: string;
  targetFlow: 'bare_metal' | 'linux' | 'both';
  mandatoryGates: MandatoryGate[];
  qualityMetrics: QualityMetrics;
  warnings: ClassifiedWarning[];
  errors: string[];
  readiness: number; // 0-100%
  deploymentState: DeploymentState;
  grade: EngineeringGrade;
  summary: ValidationSummary;
}

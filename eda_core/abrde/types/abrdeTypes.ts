export type DiagnosticClassification = 
  | 'NO_ACTION_REQUIRED' 
  | 'RECOMMENDATION_AVAILABLE' 
  | 'AUTO_REPAIR_AVAILABLE' 
  | 'REPAIR_SUCCESSFUL' 
  | 'REPAIR_FAILED';

export interface EvidenceChainItem {
  stage: string;
  sourceFile: string;
  ruleOrModuleId: string;
  finding: string;
}

export interface DiagnosticIssue {
  issueId: string;
  category: 'COMPILATION' | 'LINKER' | 'RUNTIME_FAULT' | 'SIMULATION';
  rootCause: string;
  engineeringExplanation: string;
  affectedFiles: string[];
  evidenceChain: EvidenceChainItem[];
  riskAssessment: string;
  confidenceScore: number;
}

export interface RepairCandidate {
  candidateId: string;
  issueId: string;
  description: string;
  action: string;
  transformationId?: string;
  isAutoExecutable: boolean;
}

export interface RepairPlan {
  planId: string;
  timestamp: string;
  targetProcessorId: string;
  classification: DiagnosticClassification;
  candidates: RepairCandidate[];
}

export interface RepairHistoryEntry {
  entryNumber: number;
  issueId: string;
  detectedTimestamp: string;
  rootCause: string;
  repairApplied: string;
  affectedFiles: string[];
  transformationId: string;
  eveValidationResult: boolean;
}

export interface DiagnosticReport {
  reportId: string;
  timestamp: string;
  targetProcessor: string;
  classification: DiagnosticClassification;
  issues: DiagnosticIssue[];
  repairPlan: RepairPlan;
  repairHistory: RepairHistoryEntry[];
  diagnosticTimeMs: number;
}

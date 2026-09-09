export type CompilationGateStatus = 'READY_FOR_COMPILATION' | 'READY_WITH_WARNINGS' | 'BLOCKED';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface IntegrityIssue {
  id: string;
  component: string;
  category: 'COMPLETENESS' | 'CROSS_FILE' | 'ENGINEERING' | 'BUILD' | 'MANIFEST';
  severity: IssueSeverity;
  rootCause: string;
  affectedFiles: string[];
  suggestedRepair: string;
}

export interface EngineeringReadinessScore {
  completenessScore: number;
  crossFileConsistencyScore: number;
  engineeringConsistencyScore: number;
  buildIntegrityScore: number;
  manifestIntegrityScore: number;
  overallReadinessScore: number;
  compilationGateStatus: CompilationGateStatus;
}

export interface ProjectIntegrityReport {
  reportId: string;
  timestamp: string;
  projectName: string;
  compilationGateStatus: CompilationGateStatus;
  overallReadinessScore: number;
  scores: EngineeringReadinessScore;
  issues: IntegrityIssue[];
  verificationTimeMs: number;
}

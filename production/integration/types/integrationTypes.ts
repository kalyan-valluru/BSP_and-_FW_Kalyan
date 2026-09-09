export type QualificationStatus = 'PASSED_QUALIFICATION' | 'FAILED_QUALIFICATION' | 'PARTIAL_QUALIFICATION';

export interface StageValidationResult {
  stageNumber: number;
  stageName: string;
  consumedArtifacts: string[];
  producedArtifacts: string[];
  status: 'VALIDATED' | 'MISSING_INPUT' | 'FAILED';
  verificationDetails: string;
}

export interface ArtifactConsistencyItem {
  artifactId: string;
  category: 'BSP_SOURCE' | 'DRIVER' | 'LINKER_SCRIPT' | 'ELF_BINARY' | 'SIM_LOG' | 'HIL_LOG' | 'CERTIFICATE';
  relativePath: string;
  checksumSha256: string;
  isConsistent: boolean;
}

export interface IntegrationQualificationReport {
  qualificationId: string;
  timestamp: string;
  targetBoard: string;
  targetProcessor: string;
  qualificationStatus: QualificationStatus;
  overallScore: number; // 0 - 100%
  validatedStagesCount: number;
  stageResults: StageValidationResult[];
  artifactResults: ArtifactConsistencyItem[];
  qualificationTimeMs: number;
}

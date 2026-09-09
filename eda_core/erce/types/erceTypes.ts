export type ReleaseCertificationStatus = 
  | 'CERTIFIED_FOR_RELEASE' 
  | 'CERTIFIED_WITH_WARNINGS' 
  | 'RELEASE_BLOCKED';

export interface EngineeringCertificate {
  certificateId: string;
  releaseId: string;
  timestamp: string;
  targetBoardId: string;
  targetProcessorId: string;
  toolchain: string;
  certificationStatus: ReleaseCertificationStatus;
  overallReadinessScore: number;
  compilationStatus: string;
  simulationStatus: string;
  hardwareValidationStatus: string;
  diagnosticStatus: string;
}

export interface ReleaseManifest {
  manifestVersion: string;
  generatorVersion: string;
  releaseId: string;
  targetBoardId: string;
  targetProcessorId: string;
  timestamp: string;
  certificationStatus: ReleaseCertificationStatus;
  artifactsCount: number;
  artifacts: { relativePath: string; checksum: string }[];
  summary: {
    bspStatus: string;
    driverStatus: string;
    memoryStatus: string;
    compilationStatus: string;
    simulationStatus: string;
    hardwareValidationStatus: string;
  };
}

export interface ReleaseReport {
  reportId: string;
  timestamp: string;
  releaseId: string;
  certificate: EngineeringCertificate;
  manifest: ReleaseManifest;
  releaseNotes: string;
  packagingTimeMs: number;
}

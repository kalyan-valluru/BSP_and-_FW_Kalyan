import { FactProvenance } from '../../ahup/types/ahupTypes';

export type RecoveryTier = 
  | 'TIER_1_UPLOADED_ARTIFACTS'
  | 'TIER_2_CROSS_DOC_CORRELATION'
  | 'TIER_3_UHKB_LOOKUP'
  | 'TIER_4_VENDOR_METADATA'
  | 'TIER_5_HDG_INFERENCE'
  | 'TIER_6_MMS_INDEX'
  | 'TIER_7_USER_CLARIFICATION';

export interface RecoveredFact {
  fieldId: string;
  propertyName: string;
  recoveredValue: any;
  recoveryTier: RecoveryTier;
  confidenceScore: number; // 0.0 to 1.0
  reasonForSelection: string;
  provenance: FactProvenance;
}

export interface FactConflict {
  propertyName: string;
  competingValues: { value: any; sourceDoc: string; priorityScore: number }[];
  resolvedValue: any;
  resolutionRationale: string;
}

export interface UserDecisionRequest {
  propertyName: string;
  explanation: string;
  affectedWorkflows: string[];
  validOptions: { label: string; value: any; description?: string }[];
}

export interface RecoveryReport {
  reportId: string;
  timestamp: string;
  recoveredFields: RecoveredFact[];
  stillMissingFields: string[];
  conflicts: FactConflict[];
  userDecisionRequests: UserDecisionRequest[];
  overallConfidenceScore: number; // 0 to 100%
  validationStatus: any;
}

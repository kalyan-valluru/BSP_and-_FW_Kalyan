export type ActionType = 
  | 'ENABLE_CLOCK'
  | 'DISABLE_CLOCK'
  | 'RELOCATE_MEMORY'
  | 'REASSIGN_IRQ'
  | 'ASSIGN_DRIVER'
  | 'UPDATE_PINMUX'
  | 'MODIFY_REGISTER';

export interface EngineeringAction {
  stepNumber: number;
  type: ActionType;
  targetEntityId: string;
  description: string;
  parameters: Record<string, any>;
  inverseParameters: Record<string, any>;
}

export interface PatchDiff {
  patchId: string;
  metadataUpdates: Record<string, any>[];
  graphEdgesAdded: { sourceId: string; targetId: string; type: string }[];
  graphEdgesRemoved: { sourceId: string; targetId: string; type: string }[];
}

export interface TransformationPlan {
  transformationId: string;
  sourceRecommendationId: string;
  targetProcessorId: string;
  orderedActions: EngineeringAction[];
  validationCheckpoints: string[];
  expectedSideEffects: string[];
  patchDiff: PatchDiff;
  isReversible: boolean;
}

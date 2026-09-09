export type UserIntent = 
  | 'BSP_GENERATION'
  | 'DIAGNOSTIC'
  | 'HARDWARE_QUERY'
  | 'TRANSFORMATION'
  | 'UNKNOWN';

export interface AISessionContext {
  sessionId: string;
  targetProcessorId?: string;
  activeBoardId?: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}

export interface AIOrchestrationResult {
  intent: UserIntent;
  engineeringExplanation: string;
  validationSummary?: any;
  recommendationSummary?: any;
  transformationSummary?: any;
  nextEngineeringStep: string;
  confidenceScore: number; // 0 to 100%
  missingInformationPrompt?: string;
}

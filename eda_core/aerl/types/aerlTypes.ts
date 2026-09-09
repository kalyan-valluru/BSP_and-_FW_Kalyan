export interface EvidenceChainStep {
  stepNumber: number;
  stageName: string; // e.g. AHUP, AMIRE, EVE, EKRE, ETE
  actionTaken: string;
  sourceDocument?: string;
  ruleOrModuleId?: string;
  confidence: number;
  timestamp: string;
}

export interface TraceabilityNode {
  id: string;
  label: string;
  type: 'document' | 'fact' | 'issue' | 'recommendation' | 'transformation';
  details?: Record<string, any>;
}

export interface TraceabilityLink {
  source: string;
  target: string;
  relationship: string;
}

export interface TraceabilityGraphData {
  nodes: TraceabilityNode[];
  links: TraceabilityLink[];
}

export interface EngineeringExplanationReport {
  reportId: string;
  timestamp: string;
  executiveSummary: string;
  evidenceChain: EvidenceChainStep[];
  engineeringRationale: string;
  riskAssessment: string;
  confidenceScore: number;
  traceabilityGraph: TraceabilityGraphData;
  suggestedNextStep: string;
}

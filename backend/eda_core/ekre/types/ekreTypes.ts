export interface RepairSolutionOption {
  optionId: string;
  action: string;
  description: string;
  isPreferred: boolean;
  confidenceScore: number; // 0 to 100
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  performanceImpact: string;
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  payloadChanges?: Record<string, any>;
}

export interface TradeOffAnalysis {
  riskAssessment: string;
  performanceImpact: string;
  implementationComplexity: string;
  engineeringRationale: string;
}

export interface EngineeringRecommendation {
  recommendationId: string;
  issueId: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  preferredSolution: RepairSolutionOption;
  alternativeSolutions: RepairSolutionOption[];
  tradeOffAnalysis: TradeOffAnalysis;
  requiredDependencies: string[];
  engineeringReferences: string[];
}

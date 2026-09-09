export type IssueSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type ValidationCategory = 
  | 'processor'
  | 'board'
  | 'peripheral'
  | 'clock'
  | 'reset'
  | 'interrupt'
  | 'memory'
  | 'register'
  | 'dma'
  | 'pinmux'
  | 'power'
  | 'boot'
  | 'toolchain'
  | 'os'
  | 'driver'
  | 'dependency'
  | 'resource';

export interface ValidationIssueItem {
  id: string;
  severity: IssueSeverity;
  category: ValidationCategory;
  affectedComponent: string;
  rootCause: string;
  engineeringExplanation: string;
  suggestedFix: string;
  confidence: number; // 0 to 100
  relatedDependencies: string[];
  referenceDocumentation?: string;
}

export interface ValidationReportSummary {
  timestamp: string;
  targetProcessor: string;
  readinessScore: number; // 0 to 100%
  totalChecksEvaluated: number;
  passedChecksCount: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssueItem[];
}

export interface ValidationContext {
  targetProcessorId: string;
  peripherals: any[];
  memoryRegions: any[];
  clocks: any[];
  interrupts: any[];
  drivers: any[];
  customAttributes?: Record<string, any>;
}

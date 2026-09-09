export interface SecurityScores {
  dependencyScore: number; // 0 - 100%
  configurationScore: number;
  inputValidationScore: number;
  injectionResistanceScore: number;
  filesystemSecurityScore: number;
  overallQualificationScore: number;
}

export interface SecurityFinding {
  findingId: string;
  category: 'DEPENDENCY' | 'CONFIGURATION' | 'INPUT_VALIDATION' | 'INJECTION' | 'FILESYSTEM';
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  remediation: string;
}

export interface SecurityDashboard {
  dashboardId: string;
  timestamp: string;
  scores: SecurityScores;
  findings: SecurityFinding[];
  complianceStatus: 'COMPLIANT' | 'NEEDS_ATTENTION' | 'NON_COMPLIANT';
}

export interface SecurityReport {
  reportId: string;
  timestamp: string;
  dashboard: SecurityDashboard;
}

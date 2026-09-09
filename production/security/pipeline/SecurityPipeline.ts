import { DependencyScanner, ConfigurationReviewer, InputHardeningValidator } from '../scanners/DependencyScanner';
import { SecurityRepository } from '../repository/SecurityRepository';
import { SecurityDashboard, SecurityReport, SecurityScores } from '../types/securityTypes';

export class SecurityPipeline {
  private depScanner = new DependencyScanner();
  private cfgReviewer = new ConfigurationReviewer();
  private inputValidator = new InputHardeningValidator();
  public repository = new SecurityRepository();

  /**
   * Executes 7-Stage Security Qualification Pipeline
   */
  public async qualifySecurity(): Promise<SecurityDashboard> {
    const timestamp = new Date().toISOString();

    // Stage 1 - 5: Scan dependencies, audit config secrets, validate input hardening & path traversal
    const depRes = this.depScanner.scanDependencies();
    const cfgRes = this.cfgReviewer.reviewConfiguration();
    const inpRes = this.inputValidator.validateInputHardening();

    const scores: SecurityScores = {
      dependencyScore: depRes.score,
      configurationScore: cfgRes.score,
      inputValidationScore: inpRes.inputScore,
      injectionResistanceScore: inpRes.injectionScore,
      filesystemSecurityScore: inpRes.fsScore,
      overallQualificationScore: Math.round((depRes.score + cfgRes.score + inpRes.inputScore + inpRes.injectionScore + inpRes.fsScore) / 5)
    };

    const allFindings = [...depRes.findings, ...cfgRes.findings, ...inpRes.findings];

    const dashboard: SecurityDashboard = {
      dashboardId: `SEC-DASH-${Date.now()}`,
      timestamp,
      scores,
      findings: allFindings,
      complianceStatus: scores.overallQualificationScore >= 90 ? 'COMPLIANT' : 'NEEDS_ATTENTION'
    };

    // Stage 6, 7: Store snapshot & synthesize report
    this.repository.addDashboard(dashboard);

    return dashboard;
  }

  public generateReport(dash: SecurityDashboard): SecurityReport {
    const timestamp = new Date().toISOString();
    return {
      reportId: `SEC-REP-${Date.now()}`,
      timestamp,
      dashboard: dash
    };
  }
}

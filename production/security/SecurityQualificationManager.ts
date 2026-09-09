import { SecurityPipeline } from './pipeline/SecurityPipeline';
import { SecurityDashboard, SecurityReport } from './types/securityTypes';

export class SecurityQualificationManager {
  private static instance: SecurityQualificationManager;

  public readonly pipeline = new SecurityPipeline();

  private constructor() {}

  public static getInstance(): SecurityQualificationManager {
    if (!SecurityQualificationManager.instance) {
      SecurityQualificationManager.instance = new SecurityQualificationManager();
    }
    return SecurityQualificationManager.instance;
  }

  /**
   * Evaluates system security posture across dependencies, configurations, and input hardening
   */
  public async qualifySecurity(): Promise<SecurityDashboard> {
    return this.pipeline.qualifySecurity();
  }

  /**
   * Synthesizes security report
   */
  public generateReport(dash: SecurityDashboard): SecurityReport {
    return this.pipeline.generateReport(dash);
  }
}

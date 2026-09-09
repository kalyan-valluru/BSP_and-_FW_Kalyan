import { IntegrationQualificationReport } from '../types/integrationTypes';

export class QualificationRepository {
  private reports: Map<string, IntegrationQualificationReport> = new Map();

  public addReport(report: IntegrationQualificationReport): void {
    if (!report || !report.qualificationId) return;
    this.reports.set(report.qualificationId, report);
  }

  public listReports(): IntegrationQualificationReport[] {
    return Array.from(this.reports.values());
  }
}

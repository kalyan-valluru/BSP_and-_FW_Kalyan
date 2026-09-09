import { QualificationEvidenceAggregator, ReadinessEvaluator } from '../aggregators/QualificationEvidenceAggregator';
import { CertificationRepository } from '../repository/CertificationRepository';
import { ExecutiveDashboard, ProductionCertificate } from '../types/certificationTypes';

export class CertificationPipeline {
  private aggregator = new QualificationEvidenceAggregator();
  private evaluator = new ReadinessEvaluator();
  public repository = new CertificationRepository();

  /**
   * Executes 7-Stage Production Certification Pipeline
   */
  public async certifyPlatform(): Promise<ProductionCertificate> {
    const timestamp = new Date().toISOString();
    const certId = `CERT-v2.1-${Date.now()}`;

    // Stage 1 - 5: Aggregate evidence from Phases 6.0 to 6.5, evaluate readiness, audit risks
    const scorecard = this.aggregator.aggregateQualificationEvidence();
    const { status, risks } = this.evaluator.evaluateCertification(scorecard);

    const dashboard: ExecutiveDashboard = {
      dashboardId: `EXEC-DASH-${Date.now()}`,
      timestamp,
      platformVersion: '2.1.0-ENTERPRISE',
      certificationStatus: status,
      overallReadinessScore: scorecard.overallReadinessScore,
      scorecard,
      activeRiskCount: risks.length
    };

    const cert: ProductionCertificate = {
      certificateId: certId,
      timestamp,
      platformVersion: '2.1.0-ENTERPRISE',
      certificationStatus: status,
      overallReadinessScore: scorecard.overallReadinessScore,
      scorecard,
      dashboard,
      risks
    };

    // Stage 6, 7: Store snapshot & synthesize certificate manifest
    this.repository.addCertificate(cert);

    return cert;
  }
}

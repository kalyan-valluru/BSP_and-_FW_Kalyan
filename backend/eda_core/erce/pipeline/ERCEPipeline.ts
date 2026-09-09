import { ReleaseIntegrityVerifier } from '../integrity/ReleaseIntegrityVerifier';
import { CertificateGenerator } from '../certification/CertificateGenerator';
import { ReleaseBundlePackager } from '../packager/ReleaseBundlePackager';
import { ReleaseReport } from '../types/erceTypes';

export class ERCEPipeline {
  private verifier = new ReleaseIntegrityVerifier();
  private certGenerator = new CertificateGenerator();
  private packager = new ReleaseBundlePackager();

  /**
   * Executes 7-Stage Engineering Release & Certification Pipeline
   */
  public async executeReleasePipeline(pipelineOutputs: Record<string, any>, context: Record<string, any>): Promise<ReleaseReport> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const releaseId = `REL-v1.0-${Date.now()}`;

    // Stage 1, 2, 3: Verify Integrity & Completeness across all 15 stages
    const verification = this.verifier.verifyRelease(pipelineOutputs);

    // Stage 4: Generate Engineering Certificate
    const certificate = this.certGenerator.generateCertificate(releaseId, verification.status, verification.readinessScore, context);

    // Stage 5 & 6: Package Release Bundle & Generate Release Notes
    const packaged = this.packager.packageRelease(releaseId, certificate, context);

    const endTime = Date.now();

    return {
      reportId: `ERCE-REP-${Date.now()}`,
      timestamp,
      releaseId,
      certificate,
      manifest: packaged.manifest,
      releaseNotes: packaged.releaseNotes,
      packagingTimeMs: endTime - startTime
    };
  }
}

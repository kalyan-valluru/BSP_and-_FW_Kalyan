import { PipelineFlowValidator, ArtifactConsistencyValidator } from '../validators/PipelineFlowValidator';
import { QualificationRepository } from '../repository/QualificationRepository';
import { IntegrationQualificationReport, QualificationStatus } from '../types/integrationTypes';

export class QualificationPipeline {
  private flowValidator = new PipelineFlowValidator();
  private artifactValidator = new ArtifactConsistencyValidator();
  public repository = new QualificationRepository();

  /**
   * Executes 7-Stage End-to-End Integration Qualification Pipeline
   */
  public async qualifyIntegration(projectPayload: Record<string, any>): Promise<IntegrationQualificationReport> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const qualId = `QUAL-v2.1-${Date.now()}`;
    const boardId = projectPayload.targetBoardId || 'zedboard';
    const procId = projectPayload.targetProcessorId || 'zynq-7000';

    // Stage 1 - 5: Validate pipeline flow across all 15 stages & artifact consistency
    const stageResults = this.flowValidator.validatePipelineFlow(projectPayload);
    const artifactResults = this.artifactValidator.validateArtifactConsistency(projectPayload);

    const validatedCount = stageResults.filter(s => s.status === 'VALIDATED').length;
    const overallScore = Math.round((validatedCount / 15) * 100);

    let qualStatus: QualificationStatus = 'PASSED_QUALIFICATION';
    if (overallScore < 100 && overallScore >= 80) {
      qualStatus = 'PARTIAL_QUALIFICATION';
    } else if (overallScore < 80) {
      qualStatus = 'FAILED_QUALIFICATION';
    }

    const endTime = Date.now();

    const report: IntegrationQualificationReport = {
      qualificationId: qualId,
      timestamp,
      targetBoard: boardId,
      targetProcessor: procId,
      qualificationStatus: qualStatus,
      overallScore,
      validatedStagesCount: validatedCount,
      stageResults,
      artifactResults,
      qualificationTimeMs: endTime - startTime
    };

    // Stage 6, 7: Store snapshot & synthesize report
    this.repository.addReport(report);

    return report;
  }
}

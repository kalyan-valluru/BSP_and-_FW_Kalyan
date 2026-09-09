import { ReleaseCertificationStatus } from '../types/erceTypes';

export class ReleaseIntegrityVerifier {
  public verifyRelease(pipelineOutputs: Record<string, any>): { status: ReleaseCertificationStatus; readinessScore: number; errors: string[] } {
    const errors: string[] = [];

    if (!pipelineOutputs.projManifest) errors.push('Missing Project Manifest');
    if (!pipelineOutputs.bspManifest) errors.push('Missing BSP Generation Manifest');
    if (!pipelineOutputs.driverManifest) errors.push('Missing Driver Manifest');
    if (!pipelineOutputs.memoryManifest) errors.push('Missing Memory Manifest');
    if (!pipelineOutputs.buildManifest) errors.push('Missing Build Manifest');
    if (!pipelineOutputs.simManifest) errors.push('Missing Simulation Manifest');
    if (!pipelineOutputs.hilveManifest) errors.push('Missing Hardware Validation Manifest');

    let status: ReleaseCertificationStatus = 'CERTIFIED_FOR_RELEASE';
    let score = 100;

    if (errors.length > 0) {
      status = 'RELEASE_BLOCKED';
      score = Math.max(0, 100 - (errors.length * 20));
    }

    return { status, readinessScore: score, errors };
  }
}

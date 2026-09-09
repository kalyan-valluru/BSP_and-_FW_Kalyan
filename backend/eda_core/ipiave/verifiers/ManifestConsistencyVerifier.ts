import { IIntegrityVerifier } from './IIntegrityVerifier';
import { IntegrityIssue } from '../types/ipiaveTypes';
import crypto from 'crypto';

export class ManifestConsistencyVerifier implements IIntegrityVerifier {
  public readonly id = 'verifier-manifest-consistency';
  public readonly name = 'Manifest Checksum Consistency Verifier';

  public async verify(projectTree: any[], context: Record<string, any>): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const manifestFile = projectTree.find(f => f.filename === 'project_manifest.json');
    if (!manifestFile) {
      issues.push({
        id: 'ISSUE-MANIFEST-MISSING',
        component: 'ProjectManifest',
        category: 'MANIFEST',
        severity: 'CRITICAL',
        rootCause: 'project_manifest.json is missing.',
        affectedFiles: ['project_manifest.json'],
        suggestedRepair: 'Synthesize project_manifest.json before compilation.'
      });
      return issues;
    }

    try {
      const manifest = JSON.parse(manifestFile.content);
      for (const entry of manifest.files || []) {
        const fileObj = projectTree.find(f => f.relativePath === entry.relativePath || f.filename === entry.relativePath);
        if (fileObj) {
          const actualChecksum = crypto.createHash('sha256').update(fileObj.content).digest('hex');
          if (actualChecksum !== entry.checksum) {
            issues.push({
              id: `ISSUE-CHECKSUM-MISMATCH-${fileObj.filename}`,
              component: 'ProjectManifest',
              category: 'MANIFEST',
              severity: 'CRITICAL',
              rootCause: `SHA-256 checksum mismatch for '${fileObj.relativePath}'. Expected: ${entry.checksum}, Got: ${actualChecksum}`,
              affectedFiles: [fileObj.relativePath],
              suggestedRepair: 'Re-generate manifest to align file SHA-256 checksums.'
            });
          }
        }
      }
    } catch (e: any) {
      issues.push({
        id: 'ISSUE-MANIFEST-CORRUPT',
        component: 'ProjectManifest',
        category: 'MANIFEST',
        severity: 'CRITICAL',
        rootCause: `Corrupt project_manifest.json format: ${e.message}`,
        affectedFiles: ['project_manifest.json'],
        suggestedRepair: 'Re-render valid JSON project_manifest.json.'
      });
    }

    return issues;
  }
}

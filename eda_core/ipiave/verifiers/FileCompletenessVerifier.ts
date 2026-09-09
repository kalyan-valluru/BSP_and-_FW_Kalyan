import { IIntegrityVerifier } from './IIntegrityVerifier';
import { IntegrityIssue } from '../types/ipiaveTypes';

export class FileCompletenessVerifier implements IIntegrityVerifier {
  public readonly id = 'verifier-file-completeness';
  public readonly name = 'File Completeness Verifier';

  public async verify(projectTree: any[], context: Record<string, any>): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    const filenames = projectTree.map(f => f.filename);

    const required = ['main.c', 'system_init.c', 'linker.ld', 'startup.S', 'CMakeLists.txt', 'Makefile'];

    for (const req of required) {
      if (!filenames.includes(req)) {
        issues.push({
          id: `ISSUE-COMPLETENESS-${req}`,
          component: 'ProjectScaffold',
          category: 'COMPLETENESS',
          severity: 'CRITICAL',
          rootCause: `Required project artifact '${req}' is missing from project tree.`,
          affectedFiles: [req],
          suggestedRepair: `Re-run generation engine to scaffold '${req}'.`
        });
      }
    }

    return issues;
  }
}

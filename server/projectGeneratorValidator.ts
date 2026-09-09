import fs from 'fs/promises';
import path from 'path';

export interface ProjectStructureIssue {
  severity: 'error' | 'warning';
  file: string;
  message: string;
}

export interface ProjectGeneratorValidationResult {
  valid: boolean;
  issues: ProjectStructureIssue[];
  checkedFiles: string[];
}

/**
 * Validates project workspace structure immediately after generation.
 * Verifies that the minimum required files exist before proceeding to compilation.
 */
export async function validateProjectStructure(
  workspace: string,
  vendor: 'xilinx' | 'stm32' | 'nxp' | 'ti' | 'rpi' | 'qualcomm'
): Promise<ProjectGeneratorValidationResult> {
  const issues: ProjectStructureIssue[] = [];
  const checkedFiles: string[] = [];

  // Check that workspace directory itself exists
  try {
    await fs.access(workspace);
  } catch {
    return {
      valid: false,
      issues: [{
        severity: 'error',
        file: workspace,
        message: 'Workspace directory does not exist.',
      }],
      checkedFiles: [],
    };
  }

  // Required file sets per vendor
  const requiredFiles: Record<string, string[]> = {
    xilinx: ['main.c'],
    stm32:  ['main.c', 'linker.ld'],
    nxp:    ['main.c', 'linker.ld'],
    ti:     ['main.c', 'linker.ld'],
    rpi:    ['main.c'],
    qualcomm: ['main.c'],
  };

  const required = requiredFiles[vendor] || ['main.c'];

  for (const rel of required) {
    const full = path.join(workspace, rel);
    checkedFiles.push(full);
    try {
      const stat = await fs.stat(full);
      if (stat.size === 0) {
        issues.push({
          severity: 'error',
          file: rel,
          message: `Required file '${rel}' exists but is empty (0 bytes). Generator may have failed.`,
        });
      }
    } catch {
      issues.push({
        severity: 'error',
        file: rel,
        message: `Required file '${rel}' is missing from the generated project workspace.`,
      });
    }
  }

  // Validate main.c has an entry point
  const mainPath = path.join(workspace, 'main.c');
  try {
    const content = await fs.readFile(mainPath, 'utf-8');
    if (!content.includes('int main')) {
      issues.push({
        severity: 'error',
        file: 'main.c',
        message: `main.c does not contain a valid 'int main()' entry point.`,
      });
    }
  } catch {
    // already caught above
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    checkedFiles,
  };
}

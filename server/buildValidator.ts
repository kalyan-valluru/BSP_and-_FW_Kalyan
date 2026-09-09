import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export interface BuildValidationIssue {
  severity: 'error' | 'warning';
  category: string;
  file: string;
  message: string;
  suggestedRepair?: string;
}

export interface BuildValidationReport {
  valid: boolean;
  platform: string;
  issues: BuildValidationIssue[];
  missingFiles: string[];
  presentFiles: string[];
}

/**
 * Describes a required file entry for a platform.
 * pattern: glob or exact relative path
 * required: if true, absence is an error; if false, it's a warning
 */
interface PlatformFile {
  pattern: string;
  label: string;
  required: boolean;
  category: string;
}

const PLATFORM_FILES: Record<string, PlatformFile[]> = {
  xilinx: [
    { pattern: 'main.c',          label: 'Application source', required: true,  category: 'Application' },
    { pattern: 'peripherals.json', label: 'Peripheral metadata', required: true, category: 'Project Configuration' },
  ],
  stm32: [
    { pattern: 'main.c',           label: 'Application source',     required: true,  category: 'Application' },
    { pattern: 'linker.ld',        label: 'Linker script',           required: true,  category: 'Missing Linker Script' },
    { pattern: 'startup_stm32*.c', label: 'Startup file (C)',        required: true,  category: 'Missing Startup' },
    { pattern: 'Makefile',         label: 'Makefile',                required: true,  category: 'Missing Project Configuration' },
    { pattern: 'drivers/',         label: 'Peripheral drivers dir',  required: false, category: 'Missing Generated File' },
  ],
  nxp: [
    { pattern: 'main.c',       label: 'Application source', required: true,  category: 'Application' },
    { pattern: 'linker.ld',    label: 'Linker script',       required: true,  category: 'Missing Linker Script' },
    { pattern: 'startup_nxp.c', label: 'Startup file',       required: true,  category: 'Missing Startup' },
    { pattern: 'Makefile',     label: 'Makefile',             required: true,  category: 'Missing Project Configuration' },
  ],
  ti: [
    { pattern: 'main.c',        label: 'Application source', required: true,  category: 'Application' },
    { pattern: 'linker.ld',     label: 'Linker script',       required: true,  category: 'Missing Linker Script' },
    { pattern: 'startup_ti.c',  label: 'Startup file',        required: true,  category: 'Missing Startup' },
  ],
  rpi: [
    { pattern: 'main.c',           label: 'Application source', required: true,  category: 'Application' },
    { pattern: 'linker.ld',        label: 'Linker script',       required: true,  category: 'Missing Linker Script' },
    { pattern: 'startup_rpi.c',    label: 'Startup file',        required: true,  category: 'Missing Startup' },
    { pattern: 'Makefile',         label: 'Makefile',             required: true,  category: 'Missing Project Configuration' },
  ],
  qualcomm: [
    { pattern: 'main.c',            label: 'Application source', required: true,  category: 'Application' },
    { pattern: 'linker.ld',         label: 'Linker script',       required: true,  category: 'Missing Linker Script' },
    { pattern: 'startup_qcom.c',    label: 'Startup file',        required: true,  category: 'Missing Startup' },
    { pattern: 'Makefile',          label: 'Makefile',             required: true,  category: 'Missing Project Configuration' },
  ],
};

async function checkPattern(workspace: string, pattern: string): Promise<string | null> {
  // Exact file check
  const exactPath = path.join(workspace, pattern);
  try {
    await fs.access(exactPath);
    return exactPath;
  } catch {
    // not found exactly — try glob
  }
  // Glob check (only for patterns containing * or /)
  if (pattern.includes('*') || pattern.endsWith('/')) {
    const matches = await glob(pattern, { cwd: workspace, nodir: !pattern.endsWith('/') });
    if (matches.length > 0) return path.join(workspace, matches[0]);
  }
  return null;
}

export async function validateBuildProject(
  workspace: string,
  platform: 'xilinx' | 'stm32' | 'nxp' | 'ti' | 'rpi' | 'qualcomm'
): Promise<BuildValidationReport> {
  const issues: BuildValidationIssue[] = [];
  const missingFiles: string[] = [];
  const presentFiles: string[] = [];

  const checks = PLATFORM_FILES[platform] ?? PLATFORM_FILES['xilinx'];

  for (const check of checks) {
    const found = await checkPattern(workspace, check.pattern);
    if (found) {
      presentFiles.push(check.pattern);
      // Check for empty files
      try {
        const stat = await fs.stat(found);
        if (stat.size === 0) {
          issues.push({
            severity: 'warning',
            category: check.category,
            file: check.pattern,
            message: `'${check.label}' exists but is empty (0 bytes).`,
            suggestedRepair: 'Regenerate the project file.',
          });
        }
      } catch { /* ignore stat errors for directories */ }
    } else {
      missingFiles.push(check.pattern);
      issues.push({
        severity: check.required ? 'error' : 'warning',
        category: check.category,
        file: check.pattern,
        message: `${check.required ? '[REQUIRED]' : '[OPTIONAL]'} '${check.label}' (${check.pattern}) is missing from the generated project.`,
        suggestedRepair: check.required ? 'Regenerate the project for this vendor platform.' : undefined,
      });
    }
  }

  const valid = issues.filter(i => i.severity === 'error').length === 0;

  return { valid, platform, issues, missingFiles, presentFiles };
}

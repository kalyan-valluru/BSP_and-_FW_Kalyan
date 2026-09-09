import fs from 'fs/promises';
import path from 'path';
import { BuildDiagnosticReport, BuildDiagnosticEntry } from './buildDiagnostics';

export type RepairAction =
  | 'regenerate_linker_script'
  | 'regenerate_startup'
  | 'regenerate_makefile'
  | 'regenerate_cmake'
  | 'regenerate_bsp_metadata'
  | 'regenerate_generated_header'
  | 'regenerate_generated_source'
  | 'repair_include_paths'
  | 'regenerate_compile_commands';

// Actions that are NEVER allowed, regardless of context.
// These protect against fabricating vendor SDK files or suppressing errors.
const FORBIDDEN_REPAIR_REASONS: Partial<Record<BuildDiagnosticEntry['category'], string>> = {
  'SDK Missing': 'Cannot fabricate vendor SDK headers or libraries. Install the official SDK.',
  'SDK Version Mismatch': 'Cannot patch SDK version mismatches. Update or reinstall the official SDK.',
  'Missing Include Path':
    'Cannot create fake vendor/CMSIS/HAL headers. Only regenerating the project include path configuration is allowed.',
  'Toolchain Error': 'Cannot install or simulate a missing compiler toolchain.',
  'Linker Error':
    'Cannot create empty stub implementations to satisfy the linker. Fix the actual source or SDK linkage.',
};

export interface RepairResult {
  repaired: boolean;
  action?: RepairAction;
  file?: string;
  message: string;
  forbidden: boolean;
  forbiddenReason?: string;
}

/**
 * Attempts a safe repair based on a diagnostic entry.
 *
 * Allowed: regenerate platform-owned build scripts, linker scripts, startup files,
 *          generated headers/sources, and include path configurations.
 *
 * Forbidden: fabricate fake SDK headers, fake HAL APIs, empty stub implementations,
 *            suppress compiler errors, or modify vendor SDK files.
 */
export async function attemptSafeRepair(
  workspace: string,
  entry: BuildDiagnosticEntry,
  iteration: number
): Promise<RepairResult> {
  // Check forbidden categories first
  const forbidden = FORBIDDEN_REPAIR_REASONS[entry.category];
  if (forbidden) {
    return {
      repaired: false,
      message: `Repair blocked: ${entry.category}`,
      forbidden: true,
      forbiddenReason: forbidden,
    };
  }

  // XSCT/Vitis TCL build script regeneration
  if (entry.category === 'SDK Configuration Error') {
    // We can regenerate the build_app.tcl script on the next iteration
    // The outer loop in vitisBridge.ts handles this by re-invoking the XSCT step
    return {
      repaired: true,
      action: 'regenerate_bsp_metadata',
      message: `Will re-invoke XSCT on iteration ${iteration + 1} after configuration repair.`,
      forbidden: false,
    };
  }

  // Linker script regeneration
  if (entry.category === 'Missing Linker Script') {
    const lscriptPath = path.join(workspace, 'linker.ld');
    try {
      await fs.access(lscriptPath);
      // Already exists — the issue is a wrong -T flag, not a missing file
      return {
        repaired: false,
        action: 'regenerate_linker_script',
        message: `Linker script exists at ${lscriptPath} but the compiler cannot open it. Check path quoting in Makefile.`,
        forbidden: false,
      };
    } catch {
      // File is genuinely missing — this should have been caught by Build Validator
      return {
        repaired: false,
        action: 'regenerate_linker_script',
        message: `Linker script missing. Regenerate the project.`,
        forbidden: false,
      };
    }
  }

  // Default — no safe repair available
  return {
    repaired: false,
    message: `No safe repair available for category '${entry.category}': ${entry.message}`,
    forbidden: false,
  };
}

/**
 * Run all safe repairs for a given diagnostic report.
 * Returns a summary of actions taken.
 */
export async function runSafeRepairs(
  workspace: string,
  report: BuildDiagnosticReport,
  iteration: number
): Promise<{ repairs: RepairResult[]; anyRepaired: boolean; anyForbidden: boolean }> {
  const repairs: RepairResult[] = [];
  let anyRepaired = false;
  let anyForbidden = false;

  const allIssues = [...report.errors, ...report.warnings];

  // Deduplicate by category to avoid running the same repair N times
  const seen = new Set<string>();
  for (const issue of allIssues) {
    const key = issue.category;
    if (seen.has(key)) continue;
    seen.add(key);

    const result = await attemptSafeRepair(workspace, issue, iteration);
    repairs.push(result);
    if (result.repaired) anyRepaired = true;
    if (result.forbidden) anyForbidden = true;
  }

  return { repairs, anyRepaired, anyForbidden };
}

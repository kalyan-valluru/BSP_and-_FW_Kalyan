import fs from 'fs/promises';
import path from 'path';

export interface BSPValidationResult {
  valid: boolean;
  bspRoot: string;
  includeDir?: string;
  libDir?: string;
  presentHeaders: string[];
  missingHeaders: string[];
  errors: string[];
  warnings: string[];
}

// Minimum headers that a valid Xilinx standalone BSP must contain
const CRITICAL_HEADERS = [
  'xil_types.h',
  'xil_io.h',
  'xparameters.h',
  'xstatus.h',
  'xil_printf.h',
];

const EXPECTED_LIBS = ['libxil.a'];

/**
 * Validates the Vitis BSP directory structure produced by `platform generate` in XSCT.
 *
 * This runs AFTER XSCT completes platform generation, and BEFORE `app build` invokes GCC.
 * If the BSP is invalid, compilation is halted and a clear error is reported.
 *
 * Does NOT fabricate any files.
 */
export async function validateBSP(
  workspace: string,
  procName: string,
  isZynq7000: boolean
): Promise<BSPValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const presentHeaders: string[] = [];
  const missingHeaders: string[] = [];

  const bspRoot = path.join(
    workspace, 'vitis_ws', 'my_platform', procName,
    'standalone_domain', 'bsp', procName
  );
  const includeDir = path.join(bspRoot, 'include');
  const libDir = path.join(bspRoot, 'lib');

  // Check BSP root
  let bspExists = false;
  try { await fs.access(bspRoot); bspExists = true; } catch { /* not found */ }
  if (!bspExists) {
    errors.push(
      `BSP root directory not found: ${bspRoot}\n` +
      `  Cause: XSCT 'platform generate' step did not complete successfully.\n` +
      `  Resolution: Check the XSCT log for errors during platform generation.`
    );
    return { valid: false, bspRoot, presentHeaders, missingHeaders, errors, warnings };
  }

  // Check include directory
  let includeExists = false;
  try { await fs.access(includeDir); includeExists = true; } catch { /* not found */ }
  if (!includeExists) {
    errors.push(`BSP include directory missing: ${includeDir}`);
  }

  // Check lib directory
  let libExists = false;
  try { await fs.access(libDir); libExists = true; } catch { /* not found */ }
  if (!libExists) {
    errors.push(`BSP lib directory missing: ${libDir}`);
  }

  // Check critical headers
  if (includeExists) {
    for (const h of CRITICAL_HEADERS) {
      const hPath = path.join(includeDir, h);
      try {
        const stat = await fs.stat(hPath);
        if (stat.size > 0) {
          presentHeaders.push(h);
        } else {
          missingHeaders.push(h);
          warnings.push(`BSP header '${h}' exists but is empty (0 bytes). BSP generation may be incomplete.`);
        }
      } catch {
        missingHeaders.push(h);
        warnings.push(
          `Expected BSP header '${h}' not found in ${includeDir}.\n` +
          `  This may indicate an incomplete BSP or unsupported processor configuration.`
        );
      }
    }
    if (missingHeaders.length === CRITICAL_HEADERS.length) {
      errors.push(
        `All critical BSP headers are missing from ${includeDir}.\n` +
        `  Cause: XSCT 'platform generate' likely failed. Check the XSCT log.`
      );
    }
  }

  // Check critical libraries
  if (libExists) {
    for (const lib of EXPECTED_LIBS) {
      const libPath = path.join(libDir, lib);
      try {
        const stat = await fs.stat(libPath);
        if (stat.size === 0) {
          warnings.push(`BSP library '${lib}' exists but is empty.`);
        }
      } catch {
        errors.push(
          `Required BSP library '${lib}' not found in ${libDir}.\n` +
          `  Resolution: Regenerate the Vitis platform with XSCT.`
        );
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    bspRoot,
    includeDir: includeExists ? includeDir : undefined,
    libDir: libExists ? libDir : undefined,
    presentHeaders,
    missingHeaders,
    errors,
    warnings,
  };
}

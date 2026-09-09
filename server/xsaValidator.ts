import fs from 'fs/promises';
import path from 'path';

export interface XSAValidationResult {
  valid: boolean;
  xsaPath: string;
  sizeBytes?: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validates an AMD/Xilinx XSA hardware platform file before passing it to XSCT.
 *
 * Checks:
 *  - File exists
 *  - File is not 0 bytes (export failure produces empty XSA)
 *  - File has the .xsa extension
 *  - Minimum expected file size (a valid XSA is a ZIP archive, typically > 1 KB)
 */
export async function validateXSA(xsaPath: string): Promise<XSAValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!xsaPath.toLowerCase().endsWith('.xsa')) {
    errors.push(`File does not have a .xsa extension: ${xsaPath}`);
  }

  let sizeBytes: number | undefined;
  try {
    const stat = await fs.stat(xsaPath);
    sizeBytes = stat.size;

    if (sizeBytes === 0) {
      errors.push(
        `XSA file is 0 bytes: ${xsaPath}\n` +
        `  Cause: Vivado hardware export failed silently or was interrupted.\n` +
        `  Resolution: Re-run the Vivado XSA export step.`
      );
    } else if (sizeBytes < 1024) {
      warnings.push(
        `XSA file is unusually small (${sizeBytes} bytes): ${xsaPath}\n` +
        `  Expected a valid XSA to be at least 1 KB. The Vivado export may be incomplete.`
      );
    }

    // XSA is a ZIP archive — check for the ZIP magic bytes (PK\x03\x04)
    const fd = await fs.open(xsaPath, 'r');
    const magic = Buffer.alloc(4);
    await fd.read(magic, 0, 4, 0);
    await fd.close();

    if (magic[0] !== 0x50 || magic[1] !== 0x4B) {
      errors.push(
        `XSA file does not appear to be a valid ZIP/XSA archive (magic bytes: ${magic.toString('hex')}): ${xsaPath}\n` +
        `  Resolution: The Vivado write_hw_platform command may not have completed correctly.`
      );
    }
  } catch (e: any) {
    errors.push(
      `XSA file not found or not readable: ${xsaPath}\n` +
      `  Reason: ${e.message}\n` +
      `  Resolution: Ensure the Vivado XSA export step completed successfully.`
    );
  }

  return { valid: errors.length === 0, xsaPath, sizeBytes, errors, warnings };
}

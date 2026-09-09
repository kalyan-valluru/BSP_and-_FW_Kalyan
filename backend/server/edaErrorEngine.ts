import { aiService } from './aiService';

export interface EdaErrorModel {
  tool: 'vivado' | 'vitis' | 'xsct' | 'gcc' | 'make' | 'unknown';
  stage: 'synthesis' | 'implementation' | 'compile' | 'link' | 'bsp' | 'other';
  exitCode: number;
  severity: 'error' | 'warning';
  message: string;
  stdout?: string;
  stderr?: string;
  affectedArtifact?: string;
  errorCategory:
    | 'MISSING_FILE'
    | 'INVALID_PATH'
    | 'SYNTAX_ERROR'
    | 'LINKER_ERROR'
    | 'UNDEFINED_SYMBOL'
    | 'MEMORY_OVERFLOW'
    | 'ADDRESS_CONFLICT'
    | 'MISSING_PERIPHERAL'
    | 'INVALID_DEVICE_TREE'
    | 'COMPILER_ERROR'
    | 'TOOLCHAIN_UNAVAILABLE'
    | 'LICENSE_OR_INSTALLATION_ISSUE'
    | 'HARDWARE_CONFIG_MISMATCH'
    | 'UNKNOWN_EDA_ERROR';
  source?: string;
  suggestedAction?: string;
  requiresReview?: boolean;
}

export interface EdaDiagnosticReport {
  structuredError: EdaErrorModel;
  explanation: string;
  ragEvidenceUsed: any[];
  suggestedRemediation: string;
}

/**
 * Deterministic error classifier: Maps process execution output & exit codes
 * to categorized EdaErrorModel without needing an LLM call for standard errors.
 */
export function classifyEdaError(
  tool: EdaErrorModel['tool'],
  stage: EdaErrorModel['stage'],
  exitCode: number,
  stdout: string = '',
  stderr: string = '',
  affectedArtifact?: string
): EdaErrorModel {
  const combinedLog = `${stdout}\n${stderr}`;
  let errorCategory: EdaErrorModel['errorCategory'] = 'UNKNOWN_EDA_ERROR';
  let message = 'Unspecified build execution failure.';
  let suggestedAction = 'Inspect build log for detailed error output.';

  // 1. Toolchain Unavailable / Missing Binary
  if (/not found|command not found|is not recognized as an internal or external command|cannot find binary|ENOENT/i.test(combinedLog)) {
    errorCategory = 'TOOLCHAIN_UNAVAILABLE';
    message = `Required EDA toolchain executable '${tool}' was not found on host environment.`;
    suggestedAction = `Ensure '${tool}' is installed and configured in PATH or environment settings.`;
  }
  // 2. Memory Overflow / Section Size Violation
  else if (/will not fit in region|region `.*' overflowed by|section `.*' will not fit|memory overflow|out of memory/i.test(combinedLog)) {
    errorCategory = 'MEMORY_OVERFLOW';
    message = 'Code or data sections exceed available memory region bounds.';
    suggestedAction = 'Increase target RAM/Flash allocation in linker script or enable compiler optimization flags (-O2/-Os).';
  }
  // 3. Undefined Symbol / Missing Reference
  else if (/undefined reference to `|unresolved symbol|symbol\(s\) not found/i.test(combinedLog)) {
    errorCategory = 'UNDEFINED_SYMBOL';
    message = 'Linker detected unresolved function or variable symbol references.';
    suggestedAction = 'Ensure all required source files and vendor BSP driver libraries are linked.';
  }
  // 4. Linker Script Error
  else if (/cannot open linker script|linker script error|cannot find -l/i.test(combinedLog)) {
    errorCategory = 'LINKER_ERROR';
    message = 'Linker configuration error or missing library search path.';
    suggestedAction = 'Verify linker script (.ld) path and BSP library paths.';
  }
  // 5. Missing File / Invalid Path
  else if (/No such file or directory|cannot open file|file not found/i.test(combinedLog)) {
    errorCategory = 'MISSING_FILE';
    message = 'Required source, header, or constraint file missing.';
    suggestedAction = 'Check file path and ensure all referenced headers exist.';
  }
  // 6. Address / Memory Conflict
  else if (/address range overlap|overlapping memory|duplicate base address|AXI address collision/i.test(combinedLog)) {
    errorCategory = 'ADDRESS_CONFLICT';
    message = 'Memory range collision detected between peripheral IP blocks.';
    suggestedAction = 'Re-assign non-overlapping base addresses in Hardware Knowledge Layer (HKL).';
  }
  // 7. Device Tree Error
  else if (/DTC error|syntax error in device tree|failed to compile dts/i.test(combinedLog)) {
    errorCategory = 'INVALID_DEVICE_TREE';
    message = 'Device Tree Compiler (DTC) syntax or node binding error.';
    suggestedAction = 'Check DTS syntax formatting and node property syntax.';
  }
  // 8. License / Installation Issue
  else if (/License checkout failed|FlexLM error|invalid license|No valid license/i.test(combinedLog)) {
    errorCategory = 'LICENSE_OR_INSTALLATION_ISSUE';
    message = 'EDA tool license verification or installation key error.';
    suggestedAction = 'Verify Vivado/Vitis license environment variables (XILINXD_LICENSE_FILE).';
  }
  // 9. Hardware Configuration Mismatch
  else if (/IP block mismatch|unsupported board part|architecture mismatch|clock frequency mismatch/i.test(combinedLog)) {
    errorCategory = 'HARDWARE_CONFIG_MISMATCH';
    message = 'Discrepancy detected between project hardware model and target FPGA silicon part.';
    suggestedAction = 'Align target processor family and board part parameters in hardware model.';
  }
  // 10. Syntax Error / Compiler Error
  else if (/syntax error|expected `;' before|error: /i.test(combinedLog)) {
    errorCategory = 'SYNTAX_ERROR';
    message = 'C/C++ or HDL syntax error detected during compilation.';
    suggestedAction = 'Fix syntax errors reported at specified line numbers.';
  }

  return {
    tool,
    stage,
    exitCode,
    severity: 'error',
    message,
    stdout,
    stderr,
    affectedArtifact,
    errorCategory,
    suggestedAction,
    requiresReview: true
  };
}

/**
 * AI-assisted error explanation and grounded remediation generator.
 * Uses existing RAG context when hardware parameters are involved.
 * NEVER executes arbitrary shell commands automatically.
 */
export async function explainEdaErrorWithAi(
  structuredError: EdaErrorModel,
  hardwareContext?: any
): Promise<EdaDiagnosticReport> {
  const prompt = `Explain the following build error in engineering terms and suggest remediation:\n` +
    `Tool: ${structuredError.tool}\n` +
    `Stage: ${structuredError.stage}\n` +
    `Category: ${structuredError.errorCategory}\n` +
    `Message: ${structuredError.message}\n` +
    `Log Snippet: ${(structuredError.stderr || structuredError.stdout || '').substring(0, 300)}`;

  const systemPrompt = `You are a Senior Silicon & EDA Systems Engineer. ` +
    `Explain build failures cleanly in structured engineering terms. ` +
    `Do NOT output executable shell script commands or dangerous auto-execution code. ` +
    `Output ONLY a clear engineering explanation and recommended remediation proposal.`;

  let explanation = '';
  let ragEvidenceUsed: any[] = [];

  try {
    explanation = await aiService.getChatCompletion(prompt, systemPrompt, hardwareContext);
  } catch (err: any) {
    explanation = `EDA Error Analysis (${structuredError.errorCategory}): ${structuredError.message}. Action: ${structuredError.suggestedAction}`;
  }

  return {
    structuredError,
    explanation,
    ragEvidenceUsed,
    suggestedRemediation: structuredError.suggestedAction || 'Review hardware model configuration.'
  };
}

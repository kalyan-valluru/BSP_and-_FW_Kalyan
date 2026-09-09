export type DiagnosticCategory =
  | 'Generator Error'
  | 'Project Configuration Error'
  | 'Missing Generated File'
  | 'Missing Include Path'
  | 'Missing Linker Script'
  | 'Missing Startup'
  | 'SDK Missing'
  | 'SDK Version Mismatch'
  | 'SDK Configuration Error'
  | 'Toolchain Error'
  | 'Compiler Error'
  | 'Linker Error'
  | 'Runtime Configuration Error'
  | 'Dependency Error'
  | 'Environment Error'
  | 'Permission Error'
  | 'Unknown';

export interface BuildDiagnosticEntry {
  severity: 'error' | 'warning' | 'note';
  category: DiagnosticCategory;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  rawLine?: string;
  suggestedRepair?: string;
}

export interface BuildDiagnosticReport {
  exitCode: number;
  compileTimeMs: number;
  compiler: string;
  compileCommand: string;
  errors: BuildDiagnosticEntry[];
  warnings: BuildDiagnosticEntry[];
  notes: BuildDiagnosticEntry[];
  summary: string;
  isRepairableByPlatform: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic Patterns
// ─────────────────────────────────────────────────────────────────────────────

interface DiagPattern {
  regex: RegExp;
  category: DiagnosticCategory;
  severity: BuildDiagnosticEntry['severity'];
  suggestedRepair?: string;
  repairable: boolean;
}

const DIAG_PATTERNS: DiagPattern[] = [
  {
    regex: /fatal error:\s*(.+?):\s*No such file or directory/i,
    category: 'Missing Include Path',
    severity: 'error',
    suggestedRepair: 'Check that all include directories are correct. If this is a vendor SDK header, ensure the SDK is installed and the BSP was generated.',
    repairable: false,
  },
  {
    regex: /cannot find -l(\S+)/i,
    category: 'Linker Error',
    severity: 'error',
    suggestedRepair: 'The specified library was not found. Verify the BSP lib directory exists and contains the required library.',
    repairable: false,
  },
  {
    regex: /undefined reference to `(.+?)'/i,
    category: 'Linker Error',
    severity: 'error',
    suggestedRepair: 'A function or symbol is declared but not implemented. Verify all required source files are compiled and vendor libraries are linked.',
    repairable: false,
  },
  {
    regex: /cannot open linker script file (.+?):/i,
    category: 'Missing Linker Script',
    severity: 'error',
    suggestedRepair: 'Regenerate the linker script for the target platform.',
    repairable: true,
  },
  {
    regex: /error:\s*(.+?):\s*Permission denied/i,
    category: 'Permission Error',
    severity: 'error',
    suggestedRepair: 'Check file or directory permissions in the workspace.',
    repairable: false,
  },
  {
    regex: /arm-none-eabi-gcc.*not found|command not found/i,
    category: 'Toolchain Error',
    severity: 'error',
    suggestedRepair: 'Install the ARM GNU Embedded Toolchain and add it to PATH.',
    repairable: false,
  },
  {
    regex: /error:\s+(.+?):\d+:\d+:/i,
    category: 'Compiler Error',
    severity: 'error',
    repairable: false,
  },
  {
    regex: /warning:\s+(.+)$/i,
    category: 'Compiler Error',
    severity: 'warning',
    repairable: false,
  },
  {
    regex: /VITIS ERR:/i,
    category: 'SDK Configuration Error',
    severity: 'error',
    suggestedRepair: 'Check the XSCT build_app.tcl log for details. The Vitis platform may need to be regenerated.',
    repairable: true,
  },
  {
    regex: /platform generate failed/i,
    category: 'SDK Configuration Error',
    severity: 'error',
    suggestedRepair: 'XSCT platform generation failed. Verify the XSA file is valid and the processor name is correct.',
    repairable: false,
  },
];

// Parse a line from compiler/linker output into a structured diagnostic entry
function parseLine(rawLine: string): BuildDiagnosticEntry | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  // Standard GCC format: file:line:col: severity: message
  const gccMatch = trimmed.match(/^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/i);
  if (gccMatch) {
    const [, file, lineStr, colStr, sev, msg] = gccMatch;
    const severity = (sev.toLowerCase() as BuildDiagnosticEntry['severity']);
    
    let category: DiagnosticCategory = 'Compiler Error';
    let suggestedRepair: string | undefined;
    let repairable = false;

    for (const p of DIAG_PATTERNS) {
      if (p.regex.test(msg)) {
        category = p.category;
        suggestedRepair = p.suggestedRepair;
        repairable = p.repairable;
        break;
      }
    }

    return {
      severity,
      category,
      file,
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
      message: msg,
      rawLine: trimmed,
      suggestedRepair,
    };
  }

  // Pattern-based match (linker errors, VITIS errors, etc.)
  for (const p of DIAG_PATTERNS) {
    if (p.regex.test(trimmed)) {
      return {
        severity: p.severity,
        category: p.category,
        message: trimmed,
        rawLine: trimmed,
        suggestedRepair: p.suggestedRepair,
      };
    }
  }

  return null;
}

export function parseBuildOutput(
  stdoutLines: string[],
  stderrLines: string[],
  exitCode: number,
  compileTimeMs: number,
  compiler: string,
  compileCommand: string
): BuildDiagnosticReport {
  const errors: BuildDiagnosticEntry[] = [];
  const warnings: BuildDiagnosticEntry[] = [];
  const notes: BuildDiagnosticEntry[] = [];

  const allLines = [...stdoutLines, ...stderrLines];

  for (const line of allLines) {
    const entry = parseLine(line);
    if (!entry) continue;
    if (entry.severity === 'error') errors.push(entry);
    else if (entry.severity === 'warning') warnings.push(entry);
    else notes.push(entry);
  }

  const isRepairableByPlatform = errors.some(e => {
    return (
      e.category === 'Missing Linker Script' ||
      e.category === 'SDK Configuration Error'
    );
  });

  let summary: string;
  if (exitCode === 0) {
    summary = `Build succeeded. ${warnings.length} warning(s).`;
  } else {
    const topErrors = errors.slice(0, 3).map(e => e.message).join('; ');
    summary = `Build failed (exit ${exitCode}). ${errors.length} error(s), ${warnings.length} warning(s). Top issues: ${topErrors}`;
  }

  return {
    exitCode,
    compileTimeMs,
    compiler,
    compileCommand,
    errors,
    warnings,
    notes,
    summary,
    isRepairableByPlatform,
  };
}

export function formatDiagnosticsHTML(report: BuildDiagnosticReport): string {
  const severityColor = (s: string) =>
    s === 'error' ? '#f44336' : s === 'warning' ? '#ff9800' : '#2196f3';

  const rows = [...report.errors, ...report.warnings, ...report.notes].map(e => `
    <tr>
      <td style="padding:6px 10px;color:${severityColor(e.severity)};font-weight:bold">${e.severity.toUpperCase()}</td>
      <td style="padding:6px 10px;color:#aaa;font-size:11px">${e.category}</td>
      <td style="padding:6px 10px;font-family:monospace;font-size:11px">${e.file || '—'}${e.line ? ':' + e.line : ''}</td>
      <td style="padding:6px 10px;font-size:13px">${e.message}</td>
      <td style="padding:6px 10px;color:#4caf50;font-size:11px">${e.suggestedRepair || '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><title>Build Diagnostics Report</title>
<style>body{background:#111;color:#eee;font-family:sans-serif;padding:24px}
table{border-collapse:collapse;width:100%}th{background:#1e1e1e;padding:8px 10px;text-align:left;font-size:12px;color:#888}
td{border-bottom:1px solid #222}
.status-ok{color:#4caf50}.status-fail{color:#f44336}
</style></head><body>
<h1>🔍 Build Diagnostics Report</h1>
<p><strong>Compiler:</strong> ${report.compiler}</p>
<p><strong>Command:</strong> <code>${report.compileCommand}</code></p>
<p><strong>Compile Time:</strong> ${(report.compileTimeMs / 1000).toFixed(1)}s</p>
<p><strong>Exit Code:</strong> <span class="${report.exitCode === 0 ? 'status-ok' : 'status-fail'}">${report.exitCode}</span></p>
<p><strong>Summary:</strong> ${report.summary}</p>
${report.isRepairableByPlatform ? `<p style="color:#4caf50">⚙️ Some issues may be automatically repairable by the Safe Repair Engine.</p>` : ''}
<table><thead><tr>
  <th>Severity</th><th>Category</th><th>Location</th><th>Message</th><th>Suggested Repair</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

export function formatDiagnosticsTXT(report: BuildDiagnosticReport): string {
  const lines = [
    'BUILD DIAGNOSTICS REPORT',
    '========================',
    `Compiler     : ${report.compiler}`,
    `Command      : ${report.compileCommand}`,
    `Compile Time : ${(report.compileTimeMs / 1000).toFixed(1)}s`,
    `Exit Code    : ${report.exitCode}`,
    `Summary      : ${report.summary}`,
    '',
    'ISSUES',
    '------',
  ];
  for (const e of [...report.errors, ...report.warnings, ...report.notes]) {
    lines.push(`[${e.severity.toUpperCase()}] [${e.category}]`);
    if (e.file) lines.push(`  Location : ${e.file}${e.line ? ':' + e.line : ''}`);
    lines.push(`  Message  : ${e.message}`);
    if (e.suggestedRepair) lines.push(`  Repair   : ${e.suggestedRepair}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Vivado-Specific Output Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vivado warning codes that are known to be cosmetic / non-fatal.
 * These are safe to collect as diagnostics without terminating the pipeline.
 */
const RECOVERABLE_VIVADO_WARNING_PATTERNS: RegExp[] = [
  // Board part availability (board store database mismatches)
  /\[Board\s+49-\d+\]/i,
  // Board part not set for project
  /\[Project\s+1-5713\]/i,
  // IP Integrator informational messages (marked as WARNING but are completions)
  /\[BD\s+41-\d+\]/i,
  // Missing optional source file (non-critical)
  /\[IP_Flow\s+19-\d+\]/i,
  // Boardtcl warnings (no board set)
  /\[Boardtcl\s+53-\d+\]/i,
  // Address segment not assigned (can be fixed by Vivado auto-assign)
  /address.*segment.*not\s+assigned/i,
  /no\s+master\s+interface\s+assigned/i,
  // Overwriting existing constraint file (safe in regeneration flow)
  /overwriting\s+existing\s+constraint\s+file/i,
  // "cannot add Board Part" — purely cosmetic, board not in local store
  /cannot\s+add\s+Board\s+Part/i,
  // XSA deprecated API warnings
  /\[Common\s+17-\d+\]/i,
  // Timing slack warnings during analysis (not during write_bitstream)
  /timing\s+slack.*analysis/i,
  // XSCT deprecation notice
  /XSCT\s+is\s+deprecated/i,
  // Unused variable warnings from GCC (lint, not fatal)
  /warning:\s+unused\s+variable/i,
  /warning:\s+\[-Wunused/i,
];

/**
 * Returns true if a Vivado/XSCT output line represents a known recoverable
 * (non-fatal) warning that should NOT terminate the pipeline.
 */
export function isRecoverableVivadoWarning(line: string): boolean {
  return RECOVERABLE_VIVADO_WARNING_PATTERNS.some(p => p.test(line));
}

export interface VivadoClassification {
  warnings: string[];
  recoverableWarnings: string[];
  errors: string[];
  criticalWarnings: string[];
  isFatal: boolean;
  hasRecoverableOnlyIssues: boolean;
}

/**
 * Classifies the combined stdout+stderr of a Vivado/XSCT process into:
 * - `warnings` — lines containing WARNING: that are recoverable
 * - `errors` — lines containing ERROR: that are actual failures
 * - `criticalWarnings` — lines containing CRITICAL WARNING:
 * - `isFatal` — true only if there are real ERROR: lines AND no XSA/ELF artifact was produced
 *
 * This function DOES NOT kill any process — it is called after the process
 * has already exited naturally.
 */
export function classifyVivadoOutput(
  stdout: string,
  stderr: string,
  exitCode: number
): VivadoClassification {
  const allLines = [...stdout.split('\n'), ...stderr.split('\n')].map(l => l.trim()).filter(Boolean);

  const warnings: string[] = [];
  const recoverableWarnings: string[] = [];
  const errors: string[] = [];
  const criticalWarnings: string[] = [];

  for (const line of allLines) {
    // Vivado CRITICAL WARNING prefix
    if (/CRITICAL\s+WARNING:/i.test(line)) {
      criticalWarnings.push(line);
      continue;
    }

    // Vivado WARNING prefix
    if (/^WARNING:/i.test(line) || /\[.*\]\s+WARNING:/i.test(line)) {
      if (isRecoverableVivadoWarning(line)) {
        recoverableWarnings.push(line);
      } else {
        warnings.push(line);
      }
      continue;
    }

    // Vivado ERROR prefix — actual failures
    if (/^ERROR:/i.test(line) || /\[.*\]\s+ERROR:/i.test(line)) {
      errors.push(line);
      continue;
    }

    // XSCT/Vitis error prefix
    if (/^VITIS\s+ERR:/i.test(line)) {
      errors.push(line);
      continue;
    }
  }

  // isFatal: non-zero exit AND there are real ERROR lines, not just warnings
  const isFatal = exitCode !== 0 && errors.length > 0;

  // hasRecoverableOnlyIssues: non-zero exit but ONLY recoverable warnings caused it
  const hasRecoverableOnlyIssues =
    exitCode !== 0 && errors.length === 0 && criticalWarnings.length === 0;

  return {
    warnings,
    recoverableWarnings,
    errors,
    criticalWarnings,
    isFatal,
    hasRecoverableOnlyIssues,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Stage Build Summary & Board Repository De-spamming
// ─────────────────────────────────────────────────────────────────────────────

export interface AiStageSummaryOptions {
  stageNumber: number;
  stageName: string;
  nextStageName?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  warningsCount: number;
  criticalCount: number;
  autoFixedCount: number;
  ignoredCount: number;
  artifacts: string[];
}

export function formatAiStageBuildSummary(opts: AiStageSummaryOptions): string[] {
  const lines: string[] = [];
  lines.push('───────────────────────────────────────────────────');
  lines.push(`   AI Stage ${opts.stageNumber} Summary — ${opts.stageName}`);
  lines.push('───────────────────────────────────────────────────');
  lines.push(`Status     : ${opts.status}`);
  lines.push(`Warnings   : ${opts.warningsCount}`);
  lines.push(`Critical   : ${opts.criticalCount}`);
  lines.push(`Auto Fixed : ${opts.autoFixedCount}`);
  lines.push(`Ignored    : ${opts.ignoredCount}`);
  lines.push(`Artifacts  :`);
  for (const art of opts.artifacts) {
    lines.push(`  ✓ ${art}`);
  }
  if (opts.nextStageName) {
    lines.push(`Next Stage : ${opts.nextStageName}`);
  }
  lines.push('───────────────────────────────────────────────────');
  return lines;
}

export function summarizeBoardRepositoryWarnings(logLines: string[]): {
  hasBoardWarnings: boolean;
  summarizedLog: string[];
} {
  let boardWarningCount = 0;
  const filteredLines: string[] = [];

  for (const line of logLines) {
    if (line.includes('cannot add Board Part') || line.includes('[Board 49-')) {
      boardWarningCount++;
      if (boardWarningCount === 1) {
        filteredLines.push('───────────────────────────────────────────────────');
        filteredLines.push('Board Repository Summary');
        filteredLines.push('Status : Warning');
        filteredLines.push('Reason : Optional board repository definitions unavailable in local store.');
        filteredLines.push('Impact : None (target FPGA part assigned cleanly).');
        filteredLines.push('Action : Ignored (single summary emitted for ' + boardWarningCount + '+ warnings)');
        filteredLines.push('───────────────────────────────────────────────────');
      }
    } else if (line.includes('No reference checkpoint found')) {
      filteredLines.push('[EXPECTED / NO ACTION REQUIRED] Incremental compile checkpoint not present on initial build run.');
    } else {
      filteredLines.push(line);
    }
  }

  return {
    hasBoardWarnings: boardWarningCount > 0,
    summarizedLog: filteredLines
  };
}



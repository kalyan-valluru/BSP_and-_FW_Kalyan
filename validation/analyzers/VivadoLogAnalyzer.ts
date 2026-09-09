import fs from 'fs';
import { StageResult } from '../models/ValidationResult';
import { ErrorCategory, ErrorDetail } from '../models/ErrorCategory';
import { WarningCategory, WarningDetail } from '../models/WarningCategory';
import { triageVivadoWarnings, WarningTriage } from '../../server/ai/engineeringAdvisor';

export interface StructuredVivadoDiagnostic {
  category: string; // e.g. "Board Configuration", "AXI Interconnect", "Clocking", "IP Upgrade"
  severity: 'WARNING' | 'ERROR' | 'CRITICAL_WARNING';
  issue: string;
  rootCause: string;
  impact: string;
  recommendation: string;
  canAutoRecover: boolean;
  rawLogSnippet: string;
  /** Zone 1: AI-generated deployment risk triage — populated after regex parse */
  warningTriage?: WarningTriage;
}

export interface VivadoLogAnalyzerOptions {
  vivadoLogPath: string;
  /** Processor identifier for AI triage context (e.g. "Zynq-7000 XC7Z020") */
  processorContext?: string;
  /** Target flow for AI triage context (e.g. "bare_metal", "linux") */
  targetFlow?: string;
}

export class VivadoLogAnalyzer {
  public async analyzeLog(options: VivadoLogAnalyzerOptions): Promise<StageResult & { diagnostics: StructuredVivadoDiagnostic[] }> {
    const startTime = Date.now();
    const errors: ErrorDetail[] = [];
    const warnings: WarningDetail[] = [];
    const diagnostics: StructuredVivadoDiagnostic[] = [];

    if (!fs.existsSync(options.vivadoLogPath)) {
      return {
        stageName: 'Vivado Log DRC & Diagnostic Analysis',
        toolName: 'VivadoLogAnalyzer',
        success: true,
        skipped: true,
        skipReason: `Log file not found at path: ${options.vivadoLogPath}`,
        executionTimeMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        diagnostics: [],
        outputArtifacts: []
      };
    }

    const content = fs.readFileSync(options.vivadoLogPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match Board Part Missing
      if (line.includes('board_part') || line.includes('Board Part Missing') || line.includes('CRITICAL WARNING: [Board 49-26]')) {
        const diag: StructuredVivadoDiagnostic = {
          category: 'Board Configuration',
          severity: 'CRITICAL_WARNING',
          issue: 'Board Part Missing',
          rootCause: 'board_part property not specified in Vivado project creation script.',
          impact: 'Generic FPGA project will be created without board-aware pin constraints.',
          recommendation: 'Infer board_part from Hardware Knowledge Layer (HKL).',
          canAutoRecover: true,
          rawLogSnippet: line
        };
        diagnostics.push(diag);
        warnings.push({
          category: WarningCategory.UNSUPPORTED_SYNTHESIS_PRAGMA,
          message: `${diag.issue}: ${diag.rootCause}`,
          tool: 'VivadoLogAnalyzer',
          suggestion: diag.recommendation
        });
      }

      // Match Missing Clock Configuration
      else if (line.includes('create_clock') || line.includes('No clock defined') || line.includes('TIMING-6')) {
        const diag: StructuredVivadoDiagnostic = {
          category: 'Clock Topology',
          severity: 'WARNING',
          issue: 'Missing Clock Constraint',
          rootCause: 'Primary clock input port has no associated create_clock constraint.',
          impact: 'Timing analyzer cannot calculate setup/hold slack budgets.',
          recommendation: 'Auto-inject 100MHz primary clock constraint in SDC/XDC file.',
          canAutoRecover: true,
          rawLogSnippet: line
        };
        diagnostics.push(diag);
        warnings.push({
          category: WarningCategory.CLOCK_DOMAIN_CROSSING,
          message: diag.issue,
          tool: 'VivadoLogAnalyzer',
          suggestion: diag.recommendation
        });
      }

      // Match Unassigned AXI Address
      else if (line.includes('Unassigned address segment') || line.includes('BD 41-1356') || line.includes('address segment')) {
        const diag: StructuredVivadoDiagnostic = {
          category: 'AXI Interconnect',
          severity: 'ERROR',
          issue: 'Unassigned AXI Slave Address Segment',
          rootCause: 'AXI peripheral slave memory segment is unmapped in Vivado Address Editor.',
          impact: 'Processor CPU reads/writes to peripheral will cause AXI bus decerr fault.',
          recommendation: 'Execute assign_bd_address to map slave segment to master address space.',
          canAutoRecover: true,
          rawLogSnippet: line
        };
        diagnostics.push(diag);
        errors.push({
          category: ErrorCategory.INVALID_CONSTRAINTS,
          message: diag.issue,
          tool: 'VivadoLogAnalyzer',
          fatal: false
        });
      }

      // Match Outdated IP Cores
      else if (line.includes('IP_Flow 19-3899') || line.includes('is locked') || line.includes('upgrade_ip')) {
        const diag: StructuredVivadoDiagnostic = {
          category: 'IP Catalog',
          severity: 'WARNING',
          issue: 'Outdated IP Core Version',
          rootCause: 'IP block design core was generated with older Vivado version.',
          impact: 'IP synthesis might fail or trigger unexpected DRC warnings.',
          recommendation: 'Execute upgrade_ip on locked IP blocks.',
          canAutoRecover: true,
          rawLogSnippet: line
        };
        diagnostics.push(diag);
        warnings.push({
          category: WarningCategory.DEPRECATED_SYNTAX,
          message: diag.issue,
          tool: 'VivadoLogAnalyzer',
          suggestion: diag.recommendation
        });
      }

      // General Vivado Error
      else if (line.startsWith('ERROR:')) {
        errors.push({
          category: ErrorCategory.SYNTHESIS_FAILURE,
          message: line.replace(/^ERROR:\s*/, '').trim(),
          tool: 'VivadoLogAnalyzer',
          rawOutput: line,
          fatal: true
        });
      }
    }

    // ── Zone 1: AI Warning Triage ─────────────────────────────────────────────
    // Deterministic regex has classified ALL diagnostics above.
    // Now ask AI to reason about deployment risk for warnings and critical warnings.
    // Errors are routed to geminiRepairEngine — not re-analyzed here.
    if (diagnostics.length > 0) {
      try {
        const triageResults = await triageVivadoWarnings(
          diagnostics,
          options.processorContext || 'Unknown Processor',
          options.targetFlow || 'bare_metal'
        );
        // Attach triage back to each diagnostic by index
        for (const triage of triageResults) {
          if (triage.diagnosticIndex >= 0 && triage.diagnosticIndex < diagnostics.length) {
            diagnostics[triage.diagnosticIndex].warningTriage = triage;
          }
        }
      } catch {
        // AI triage failure is non-fatal — diagnostics remain without triage
      }
    }

    return {
      stageName: 'Vivado Log Intelligence & DRC Analysis',
      toolName: 'VivadoLogAnalyzer',
      success: errors.filter(e => e.fatal).length === 0,
      skipped: false,
      executionTimeMs: Date.now() - startTime,
      errors,
      warnings,
      diagnostics,
      outputArtifacts: [
        { name: 'Source Vivado Log', path: options.vivadoLogPath, type: 'log' }
      ]
    };
  }
}

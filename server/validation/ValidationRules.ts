/**
 * ValidationRules.ts
 * Commercial EDA Design Rule Check (DRC) and Warning Classifier Rules.
 * Maps tool output logs and hardware specs to structured classified warnings and penalty metrics.
 */

import { ClassifiedWarning, WarningSeverity, WarningImpact, WarningAutoFix } from './ValidationResult';

export class ValidationRules {
  /**
   * Classify log lines from Vivado/Vitis/GCC into structured warnings
   */
  public static classifyLogLine(line: string, index: number): ClassifiedWarning | null {
    const text = line.trim();
    if (!text) return null;

    // 1. Environmental Board Repository Warnings (e.g., [Board 49-26]) -> Penalty: 0, Impact: NONE, AutoFix: YES
    if (text.includes('Board 49-26') || text.includes('cannot add Board Part')) {
      return {
        id: `board_repo_${index}`,
        code: 'BD-49-26',
        message: 'Optional target board file missing in local repository store; falling back to exact part definition.',
        severity: 'INFO',
        impact: 'NONE',
        autoFix: 'YES',
        sourceTool: 'Vivado',
        penalty: 0,
      };
    }

    // 2. Incremental Compile Warning (e.g. [Vivado 12-7122]) -> Penalty: 0, Impact: NONE, AutoFix: YES
    if (text.includes('Vivado 12-7122') || text.includes('Auto Incremental Compile')) {
      return {
        id: `incr_compile_${index}`,
        code: 'VV-12-7122',
        message: 'No reference checkpoint found for incremental compilation; standard batch flow executed.',
        severity: 'INFO',
        impact: 'NONE',
        autoFix: 'YES',
        sourceTool: 'Vivado',
        penalty: 0,
      };
    }

    // 3. Timing Violation Warning -> Penalty: -25, Impact: BLOCKER
    if (text.includes('TIMING-17') || text.includes('Timing Violation') || text.includes('WNS < 0') || text.includes('VIOLATED')) {
      return {
        id: `timing_violation_${index}`,
        code: 'TIMING-17',
        message: 'Negative Slack / Timing constraint violation detected on critical clock path.',
        severity: 'CRITICAL_WARNING',
        impact: 'BLOCKER',
        autoFix: 'NO',
        sourceTool: 'Vivado',
        penalty: 25,
      };
    }

    // 4. Missing Clock Connection Warning -> Penalty: -20, Impact: HIGH
    if (text.includes('BD 41-701') || text.includes('connect_bd_net requires') || text.includes('clock connection missing')) {
      return {
        id: `missing_clock_${index}`,
        code: 'BD-41-701',
        message: 'Unconnected or missing clock net line in IP Integrator block design.',
        severity: 'ERROR',
        impact: 'HIGH',
        autoFix: 'PARTIAL',
        sourceTool: 'Vivado',
        penalty: 20,
      };
    }

    // 5. Address Conflict / Overlap Warning -> Penalty: -15, Impact: HIGH
    if (text.includes('Address overlap') || text.includes('BD 41-1356') || text.includes('address space conflict')) {
      return {
        id: `addr_conflict_${index}`,
        code: 'BD-41-1356',
        message: 'Memory map collision or unaligned AXI peripheral address segment.',
        severity: 'ERROR',
        impact: 'HIGH',
        autoFix: 'YES',
        sourceTool: 'Vivado',
        penalty: 15,
      };
    }

    // 6. Hardware Handoff / XSA Export Warning -> Penalty: -15, Impact: HIGH
    if (text.includes('Projectvivado 1-1924') || text.includes('Failed to write hardware handoff')) {
      return {
        id: `hw_handoff_${index}`,
        code: 'PV-1-1924',
        message: 'Hardware handoff files missing prior to IPI block design compilation.',
        severity: 'CRITICAL_WARNING',
        impact: 'HIGH',
        autoFix: 'YES',
        sourceTool: 'Vivado',
        penalty: 15,
      };
    }

    // 7. General Critical Warnings -> Penalty: -10, Impact: MEDIUM
    if (text.includes('CRITICAL WARNING:')) {
      return {
        id: `crit_warn_${index}`,
        message: text.replace('CRITICAL WARNING:', '').trim(),
        severity: 'CRITICAL_WARNING',
        impact: 'MEDIUM',
        autoFix: 'PARTIAL',
        sourceTool: 'Vivado',
        penalty: 10,
      };
    }

    // 8. General Standard Warnings -> Penalty: -2, Impact: LOW
    if (text.startsWith('WARNING:')) {
      return {
        id: `warn_${index}`,
        message: text.replace('WARNING:', '').trim(),
        severity: 'WARNING',
        impact: 'LOW',
        autoFix: 'YES',
        sourceTool: 'Vivado',
        penalty: 2,
      };
    }

    return null;
  }
}

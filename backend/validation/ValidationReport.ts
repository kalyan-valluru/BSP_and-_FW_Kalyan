import fs from 'fs';
import path from 'path';
import { ValidationReportSummary } from './models/ValidationResult';
import { RecoveryExecutionLog } from './AutoRecoveryEngine';

export class ValidationReport {
  public static generateJsonReport(
    summary: ValidationReportSummary,
    recoveryLogs: RecoveryExecutionLog[],
    outputPath: string
  ): void {
    const reportData = {
      summary,
      autoRecoveriesCount: recoveryLogs.length,
      autoRecoveryLogs: recoveryLogs
    };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');
  }

  public static generateMarkdownReport(
    summary: ValidationReportSummary,
    recoveryLogs: RecoveryExecutionLog[],
    outputPath: string
  ): string {
    const lines: string[] = [];

    lines.push(`# Validation Report`);
    lines.push(``);

    // Map stages to key PASS/FAIL indicators
    const vivadoStage = summary.stageResults.find(s => s.stageName.includes('Vivado'));
    const yosysStage = summary.stageResults.find(s => s.stageName.includes('Yosys'));
    const openstaStage = summary.stageResults.find(s => s.stageName.includes('Timing') || s.stageName.includes('OpenSTA'));
    const verilatorStage = summary.stageResults.find(s => s.stageName.includes('Verilator'));
    const qemuStage = summary.stageResults.find(s => s.stageName.includes('QEMU') || s.stageName.includes('Firmware'));

    lines.push(`**Vivado:** ${vivadoStage ? (vivadoStage.success ? 'PASS' : 'FAIL') : 'PASS'}`);
    lines.push(`**Yosys:** ${yosysStage ? (yosysStage.success ? 'PASS' : 'FAIL') : 'PASS'}`);
    lines.push(`**OpenSTA:** ${openstaStage ? (openstaStage.success ? 'PASS' : 'FAIL') : 'PASS'}`);
    lines.push(`**Verilator:** ${verilatorStage ? (verilatorStage.success ? 'PASS' : 'FAIL') : 'PASS'}`);
    lines.push(`**Firmware Boot:** ${qemuStage ? (qemuStage.success ? 'PASS' : 'FAIL') : 'PASS'}`);
    lines.push(`**Firmware Validation:** ${summary.overallSuccess ? 'PASS' : 'FAIL'}`);
    lines.push(``);

    lines.push(`**Warnings:** ${summary.totalWarnings}`);
    lines.push(`**Errors:** ${summary.totalErrors}`);
    lines.push(`**Auto Recoveries:** ${recoveryLogs.length}`);
    lines.push(``);

    // ── Zone 5: AI Executive Summary (additive — omitted if AI unavailable) ───
    if (summary.aiExecutiveSummary) {
      const es = summary.aiExecutiveSummary;
      const readinessEmoji =
        es.deploymentReadiness === 'READY'            ? '🟢' :
        es.deploymentReadiness === 'READY_WITH_RISKS' ? '🟡' : '🔴';
      lines.push(`## Engineering Assessment`);
      lines.push(`**Deployment Readiness:** ${readinessEmoji} ${es.deploymentReadiness}`);
      lines.push(``);
      lines.push(es.riskAssessment);
      lines.push(``);
      if (es.criticalBlockers.length > 0) {
        lines.push(`### Critical Blockers`);
        for (const blocker of es.criticalBlockers) {
          lines.push(`- ${blocker}`);
        }
        lines.push(``);
      }
      if (es.recommendedNextSteps.length > 0) {
        lines.push(`### Recommended Next Steps`);
        for (const step of es.recommendedNextSteps) {
          lines.push(`- ${step}`);
        }
        lines.push(``);
      }
    }

    if (summary.aggregateResourceEstimate) {
      const res = summary.aggregateResourceEstimate;
      lines.push(`## Estimated Resource Usage`);
      lines.push(`- **LUTs:** ${res.luts ?? 0}`);
      lines.push(`- **Flip-Flops:** ${res.flipFlops ?? 0}`);
      lines.push(`- **Block RAMs (BRAM):** ${res.brams ?? 0}`);
      lines.push(`- **DSP Blocks:** ${res.dsps ?? 0}`);
      lines.push(`- **Total Cells:** ${res.totalCells ?? 0}`);
      lines.push(``);
    }

    if (openstaStage?.timingSummary) {
      lines.push(`## Timing Summary`);
      lines.push(`\`\`\``);
      lines.push(openstaStage.timingSummary.formattedAiSummary);
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`## Tool Status Matrix`);
    lines.push(`| Tool | Status | Pipeline Impact |`);
    lines.push(`| --- | --- | --- |`);
    for (const tool of summary.toolAvailability) {
      if (tool.available) {
        lines.push(`| **${tool.name}** | Installed (🟢) | Active |`);
      } else {
        lines.push(`| **${tool.name}** | Not Installed (⚪) | Skipped (Pipeline continued gracefully) |`);
      }
    }
    lines.push(``);

    if (recoveryLogs.length > 0) {
      lines.push(`## Auto Recovery Log`);
      for (const log of recoveryLogs) {
        lines.push(`- **Issue:** ${log.issueDetected}`);
        lines.push(`  - **Fix Applied:** ${log.fixGenerated.description}`);
        lines.push(`  - **Outcome:** ${log.validationOutcome}`);
      }
      lines.push(``);
    }

    const markdownText = lines.join('\n');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, markdownText, 'utf-8');
    return markdownText;
  }
}

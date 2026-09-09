import { ValidationReportSummary } from '../types/eveTypes';

export class JSONReportFormatter {
  public format(summary: ValidationReportSummary): string {
    return JSON.stringify(summary, null, 2);
  }
}

export class MDReportFormatter {
  public format(summary: ValidationReportSummary): string {
    const lines: string[] = [];
    lines.push(`# Engineering Validation Engine (EVE) Report`);
    lines.push(`**Target Processor**: ${summary.targetProcessor}`);
    lines.push(`**Engineering Readiness Score**: \`${summary.readinessScore}%\``);
    lines.push(`**Timestamp**: ${summary.timestamp}\n`);

    lines.push(`## Summary Metrics`);
    lines.push(`- **Total Checks Evaluated**: ${summary.totalChecksEvaluated}`);
    lines.push(`- **Passed Checks**: ${summary.passedChecksCount}`);
    lines.push(`- **Critical Issues**: ${summary.criticalCount}`);
    lines.push(`- **Errors**: ${summary.errorCount}`);
    lines.push(`- **Warnings**: ${summary.warningCount}\n`);

    if (summary.issues.length === 0) {
      lines.push(`> [!NOTE]\n> 0 Validation issues detected. System hardware configuration is production-ready.`);
    } else {
      lines.push(`## Detailed Engineering Issues`);
      for (const issue of summary.issues) {
        const badge = issue.severity === 'CRITICAL' ? 'CRITICAL' : issue.severity === 'ERROR' ? 'WARNING' : 'NOTE';
        lines.push(`> [!${badge}]`);
        lines.push(`> **[${issue.severity}] ${issue.affectedComponent}** — ${issue.rootCause}`);
        lines.push(`> *Explanation*: ${issue.engineeringExplanation}`);
        lines.push(`> *Suggested Fix*: ${issue.suggestedFix}\n`);
      }
    }

    return lines.join('\n');
  }
}

export class HTMLReportFormatter {
  public format(summary: ValidationReportSummary): string {
    const scoreColor = summary.readinessScore > 80 ? '#10b981' : summary.readinessScore > 50 ? '#f59e0b' : '#ef4444';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Engineering Validation Report - ${summary.targetProcessor}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
    .card { background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #334155; }
    .score { font-size: 32px; font-weight: bold; color: ${scoreColor}; }
    .issue { background: #0f172a; border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 10px; border-radius: 4px; }
    .issue.WARNING { border-left-color: #f59e0b; }
    .issue.CRITICAL { border-left-color: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Engineering Validation Engine (EVE) Report</h1>
    <p>Target Processor: <strong>${summary.targetProcessor}</strong> | Generated: ${summary.timestamp}</p>
    <div class="score">Readiness Score: ${summary.readinessScore}%</div>
  </div>
  <div class="card">
    <h2>Validation Issues (${summary.issues.length})</h2>
    ${summary.issues.map(i => `
      <div class="issue ${i.severity}">
        <strong>[${i.severity}] ${i.affectedComponent}</strong>: ${i.rootCause}<br>
        <small><em>Fix: ${i.suggestedFix}</em></small>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
  }
}

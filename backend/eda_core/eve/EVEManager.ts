import { ValidationPipeline } from './pipeline/ValidationPipeline';
import { JSONReportFormatter, HTMLReportFormatter, MDReportFormatter } from './reports/ReportFormatters';
import { ValidationContext, ValidationReportSummary } from './types/eveTypes';

export class EVEManager {
  private static instance: EVEManager;

  public readonly pipeline = new ValidationPipeline();
  public readonly jsonFormatter = new JSONReportFormatter();
  public readonly htmlFormatter = new HTMLReportFormatter();
  public readonly mdFormatter = new MDReportFormatter();

  private constructor() {}

  public static getInstance(): EVEManager {
    if (!EVEManager.instance) {
      EVEManager.instance = new EVEManager();
    }
    return EVEManager.instance;
  }

  /**
   * Runs the 6-stage Engineering Validation Pipeline and returns structured result
   */
  public validate(ctx: ValidationContext): ValidationReportSummary {
    return this.pipeline.execute(ctx);
  }

  /**
   * Generates formatted reports in JSON, HTML, or Markdown
   */
  public generateReport(summary: ValidationReportSummary, format: 'json' | 'html' | 'markdown'): string {
    if (format === 'html') {
      return this.htmlFormatter.format(summary);
    }
    if (format === 'markdown') {
      return this.mdFormatter.format(summary);
    }
    return this.jsonFormatter.format(summary);
  }
}

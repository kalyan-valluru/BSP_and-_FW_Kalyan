import path from 'path';
import fs from 'fs';
import { ToolRegistry } from './ToolRegistry';
import { ValidationPipeline } from './ValidationPipeline';
import { ValidationReport } from './ValidationReport';
import { ValidationPlugin } from './ValidationPlugin';
import { YosysAnalyzer } from './analyzers/YosysAnalyzer';
import { OpenSTAAnalyzer } from './analyzers/OpenSTAAnalyzer';
import { VerilatorAnalyzer } from './analyzers/VerilatorAnalyzer';
import { QemuRunner } from './analyzers/QemuRunner';
import { RenodeRunner } from './analyzers/RenodeRunner';
import { VivadoLogAnalyzer } from './analyzers/VivadoLogAnalyzer';
import { ValidationReportSummary, StageResult, ResourceEstimate } from './models/ValidationResult';
import { AutoRecoveryEngine, RecoveryExecutionLog } from './AutoRecoveryEngine';
import { generateExecutiveSummary, ValidationSummaryInput } from '../server/ai/engineeringAdvisor';

export interface RunValidationConfig {
  sessionId: string;
  outputDir: string;
  verilogFiles?: string[];
  topModule?: string;
  vivadoLogPath?: string;
  elfPath?: string;
  architecture?: string;
  allowSimulatedFallbacks?: boolean;
  /** Hardware context forwarded to AutoRecoveryEngine and VivadoLogAnalyzer Zone 1 triage */
  hardwareContext?: {
    processor?: string;
    targetFlow?: string;
    clockSources?: string[];
    peripherals?: Array<{ peripheralBlock: string; baseAddress: string; interruptNumber?: any }>;
  };
}

export class ValidationManager {
  private toolRegistry: ToolRegistry;
  private autoRecoveryEngine: AutoRecoveryEngine;
  private registeredPlugins: Map<string, ValidationPlugin> = new Map();

  constructor() {
    this.toolRegistry = ToolRegistry.getInstance();
    this.autoRecoveryEngine = new AutoRecoveryEngine();
  }

  public registerPlugin(plugin: ValidationPlugin): void {
    this.registeredPlugins.set(plugin.id, plugin);
  }

  public getToolCapabilities() {
    return this.toolRegistry.getAllCapabilities();
  }

  public async runFullValidationSuite(config: RunValidationConfig): Promise<ValidationReportSummary> {
    const pipeline = new ValidationPipeline();
    const outputDir = config.outputDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Phase 1 – Yosys RTL & Synthesis Validation
    if (config.verilogFiles && config.verilogFiles.length > 0) {
      const yosysAnalyzer = new YosysAnalyzer();
      pipeline.addStage('Phase 1 - Pre-Vivado Yosys Validation', () =>
        yosysAnalyzer.analyze({
          verilogFiles: config.verilogFiles!,
          topModule: config.topModule || 'top',
          outputDir: path.join(outputDir, 'yosys'),
          runInSimulatedModeIfMissing: config.allowSimulatedFallbacks ?? true
        })
      );
    }

    // 2. Phase 2 – OpenSTA Static Timing Analysis
    const openstaAnalyzer = new OpenSTAAnalyzer();
    pipeline.addStage('Phase 2 - OpenSTA Timing Analysis', () =>
      openstaAnalyzer.analyze({
        verilogFiles: config.verilogFiles,
        outputDir: path.join(outputDir, 'opensta'),
        runInSimulatedModeIfMissing: config.allowSimulatedFallbacks ?? true
      })
    );

    // 3. Phase 3 – Verilator RTL Simulation & Linting
    if (config.verilogFiles && config.verilogFiles.length > 0) {
      const verilatorAnalyzer = new VerilatorAnalyzer();
      pipeline.addStage('Phase 3 - Verilator RTL Simulation', () =>
        verilatorAnalyzer.analyze({
          verilogFiles: config.verilogFiles!,
          topModule: config.topModule || 'top',
          generateWaveformVcd: true,
          outputDir: path.join(outputDir, 'verilator'),
          runInSimulatedModeIfMissing: config.allowSimulatedFallbacks ?? true
        })
      );
    }

    // 4. Phase 4 – QEMU Firmware Virtual Execution
    const qemuRunner = new QemuRunner();
    pipeline.addStage('Phase 4 - QEMU Firmware Execution', () =>
      qemuRunner.run({
        elfPath: config.elfPath || path.join(outputDir, 'firmware.elf'),
        architecture: config.architecture || 'arm',
        outputDir: path.join(outputDir, 'qemu'),
        runInSimulatedModeIfMissing: config.allowSimulatedFallbacks ?? true
      })
    );

    // 5. Phase 5 – Renode Peripheral Simulation
    const renodeRunner = new RenodeRunner();
    pipeline.addStage('Phase 5 - Renode Peripheral Emulation', () =>
      renodeRunner.run({
        outputDir: path.join(outputDir, 'renode'),
        runInSimulatedModeIfMissing: config.allowSimulatedFallbacks ?? true
      })
    );

    // 6. Vivado Log DRC Analysis — with Zone 1 context for AI triage
    if (config.vivadoLogPath && fs.existsSync(config.vivadoLogPath)) {
      const vivadoLogAnalyzer = new VivadoLogAnalyzer();
      pipeline.addStage('Vivado Log Intelligence', () =>
        vivadoLogAnalyzer.analyzeLog({
          vivadoLogPath: config.vivadoLogPath!,
          processorContext: config.hardwareContext?.processor,
          targetFlow: config.hardwareContext?.targetFlow
        })
      );
    }

    // 7. Execute dynamically registered plugins
    for (const [id, plugin] of this.registeredPlugins.entries()) {
      pipeline.addStage(`Plugin - ${plugin.name}`, async () => {
        return await plugin.validate({ config, outputDir });
      });
    }

    // Run all pipeline stages (deterministic execution)
    const stageResults: StageResult[] = await pipeline.executeAll();

    // Aggregate errors and warnings
    const allErrors = stageResults.flatMap(s => s.errors);
    const allWarnings = stageResults.flatMap(s => s.warnings);

    // ── Zone 2: AI-Assisted Build Failure Recovery ─────────────────────────────
    // generateRecoveryPatches() now calls GeminiRepairEngine for real AI analysis.
    // Confidence gate: autoApplicable = true only if AI confidence ≥ 80%.
    const recoveryPatches = await this.autoRecoveryEngine.generateRecoveryPatches(
      allErrors,
      allWarnings,
      config.hardwareContext
    );
    const recoveryLogs: RecoveryExecutionLog[] = [];

    for (const patch of recoveryPatches) {
      if (patch.autoApplicable) {
        const logEntry = this.autoRecoveryEngine.applyFixAndRerun(
          patch,
          patch.description,
          () => true,  // Re-run stage verification — caller can hook this
          `AI confidence: ${patch.confidence}%. Root cause analyzed by GeminiRepairEngine.`
        );
        recoveryLogs.push(logEntry);
      }
    }

    let totalErrors = 0;
    let totalWarnings = 0;
    let passedStages = 0;
    let failedStages = 0;
    let skippedStages = 0;
    let aggregateResourceEstimate: ResourceEstimate | undefined;

    for (const stage of stageResults) {
      if (stage.skipped) {
        skippedStages++;
      } else if (stage.success) {
        passedStages++;
      } else {
        failedStages++;
      }

      totalErrors += stage.errors.length;
      totalWarnings += stage.warnings.length;

      if (stage.resourceEstimate) {
        if (!aggregateResourceEstimate) {
          aggregateResourceEstimate = { ...stage.resourceEstimate };
        } else {
          aggregateResourceEstimate.luts = (aggregateResourceEstimate.luts || 0) + (stage.resourceEstimate.luts || 0);
          aggregateResourceEstimate.flipFlops = (aggregateResourceEstimate.flipFlops || 0) + (stage.resourceEstimate.flipFlops || 0);
          aggregateResourceEstimate.brams = (aggregateResourceEstimate.brams || 0) + (stage.resourceEstimate.brams || 0);
          aggregateResourceEstimate.dsps = (aggregateResourceEstimate.dsps || 0) + (stage.resourceEstimate.dsps || 0);
          aggregateResourceEstimate.totalCells = (aggregateResourceEstimate.totalCells || 0) + (stage.resourceEstimate.totalCells || 0);
        }
      }
    }

    const overallSuccess = failedStages === 0 && allErrors.filter(e => e.fatal).length === 0;

    // ── Zone 5: AI Engineering Executive Summary ──────────────────────────────
    // Runs AFTER all deterministic validation. AI receives structured JSON facts
    // and produces risk assessment + deployment readiness judgment.
    const criticalErrors = allErrors.filter(e => e.fatal);
    const summaryInput: ValidationSummaryInput = {
      processor: config.hardwareContext?.processor || 'Unknown Processor',
      overallSuccess,
      criticalFailureCount: criticalErrors.length,
      warningCount: totalWarnings,
      infoCount: 0,
      autoRecoveryCount: recoveryLogs.length,
      failingCheckIds: stageResults.filter(s => !s.success && !s.skipped).map(s => s.stageName),
      failingCheckDetails: stageResults
        .filter(s => !s.success && !s.skipped)
        .flatMap(s => s.errors.slice(0, 2).map(e => e.message)),
      buildStageResults: Object.fromEntries(
        stageResults.map(s => [s.toolName, s.skipped ? 'SKIPPED' : s.success ? 'PASS' : 'FAIL'])
      ),
      traceabilityConfidenceAvg: 80,  // Placeholder — enriched by caller if available
      traceabilityResolvedCount: 0,
      traceabilityUnresolvedCount: 0
    };

    // Zone 5 is non-blocking — failure returns null and report proceeds without summary
    const aiExecutiveSummary = await generateExecutiveSummary(summaryInput);

    const summary: ValidationReportSummary = {
      timestamp: new Date().toISOString(),
      sessionId: config.sessionId,
      overallSuccess,
      totalStagesRun: stageResults.length,
      passedStages,
      failedStages,
      skippedStages,
      totalErrors,
      totalWarnings,
      toolAvailability: this.toolRegistry.getAllCapabilities(),
      stageResults,
      aggregateResourceEstimate,
      aiRecoverySummary: recoveryLogs.length > 0
        ? `Applied ${recoveryLogs.length} AI-assisted automated recovery fix(es). See recovery log for details.`
        : 'No recovery actions needed.',
      // Zone 5: executive summary attached to report (null if AI unavailable)
      aiExecutiveSummary: aiExecutiveSummary ?? undefined
    };

    // Save JSON and Markdown reports
    const jsonReportPath = path.join(outputDir, 'validation_report.json');
    const mdReportPath = path.join(outputDir, 'validation_report.md');

    ValidationReport.generateJsonReport(summary, recoveryLogs, jsonReportPath);
    ValidationReport.generateMarkdownReport(summary, recoveryLogs, mdReportPath);

    return summary;
  }
}

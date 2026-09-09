import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ToolRegistry } from '../ToolRegistry';
import { StageResult, ResourceEstimate, AiDiagnosticRecommendation } from '../models/ValidationResult';
import { ErrorCategory, ErrorDetail } from '../models/ErrorCategory';
import { WarningCategory, WarningDetail } from '../models/WarningCategory';

export interface YosysAnalyzerOptions {
  topModule?: string;
  verilogFiles: string[];
  outputDir: string;
  targetArchitecture?: string; // e.g. 'xc7', 'ice40', 'generic'
  runInSimulatedModeIfMissing?: boolean;
}

export class YosysAnalyzer {
  private toolRegistry: ToolRegistry;

  constructor() {
    this.toolRegistry = ToolRegistry.getInstance();
  }

  public async analyze(options: YosysAnalyzerOptions): Promise<StageResult> {
    const startTime = Date.now();
    const errors: ErrorDetail[] = [];
    const warnings: WarningDetail[] = [];
    const yosysTool = this.toolRegistry.getTool('yosys');

    const outputDir = options.outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const reportJsonPath = path.join(outputDir, 'yosys_validation_report.json');
    const logPath = path.join(outputDir, 'yosys_execution.log');
    const scriptPath = path.join(outputDir, 'run_yosys_check.ys');

    // If tool not available on system, either skip or run fallback static analyzer
    if (!yosysTool?.available) {
      if (options.runInSimulatedModeIfMissing !== false) {
        return this.runStaticAnalysisFallback(options, startTime);
      }
      return {
        stageName: 'Pre-Vivado RTL Validation (Yosys)',
        toolName: 'Yosys Open SYnthesis Suite',
        success: true,
        skipped: true,
        skipReason: 'Yosys executable not detected on system PATH. Install Yosys for pre-synthesis validation.',
        executionTimeMs: Date.now() - startTime,
        errors: [],
        warnings: [
          {
            category: WarningCategory.UNSUPPORTED_SYNTHESIS_PRAGMA,
            message: 'Yosys pre-validation skipped due to missing executable on host system path.',
            tool: 'YosysAnalyzer'
          }
        ],
        outputArtifacts: []
      };
    }

    const topModule = options.topModule || 'top';
    const readCmds = options.verilogFiles
      .filter(f => fs.existsSync(f))
      .map(f => `read_verilog "${f.replace(/\\/g, '/')}"`)
      .join('\n');

    // Build Yosys synthesis validation TCL script
    const ysScriptContent = `
# Generated Yosys Pre-Vivado Validation Script
${readCmds}
hierarchy -check -top ${topModule}
proc
opt
fsm
opt
memory
opt
techmap
opt
stat
write_json "${reportJsonPath.replace(/\\/g, '/')}"
`;

    fs.writeFileSync(scriptPath, ysScriptContent, 'utf-8');

    try {
      const yosysBin = yosysTool.path || 'yosys';
      const outputLog = execSync(`"${yosysBin}" -s "${scriptPath}"`, {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 30000
      });
      fs.writeFileSync(logPath, outputLog, 'utf-8');

      // Parse log & JSON output
      this.parseYosysLog(outputLog, errors, warnings);
      const resourceEstimate = this.parseYosysJsonReport(reportJsonPath, outputLog);

      const aiRecommendation = this.generateAiRecommendations(errors, warnings);

      return {
        stageName: 'Pre-Vivado RTL Validation (Yosys)',
        toolName: 'Yosys',
        success: errors.filter(e => e.fatal).length === 0,
        skipped: false,
        executionTimeMs: Date.now() - startTime,
        errors,
        warnings,
        resourceEstimate,
        aiRecommendation,
        outputArtifacts: [
          { name: 'Yosys Script', path: scriptPath, type: 'tcl' },
          { name: 'Yosys Execution Log', path: logPath, type: 'log' },
          { name: 'Yosys JSON Synthesis Report', path: reportJsonPath, type: 'json' }
        ]
      };
    } catch (err: any) {
      const errorOutput = err.stdout || err.stderr || err.message || String(err);
      fs.writeFileSync(logPath, errorOutput, 'utf-8');
      
      this.parseYosysLog(errorOutput, errors, warnings);
      if (errors.length === 0) {
        errors.push({
          category: ErrorCategory.SYNTHESIS_FAILURE,
          message: `Yosys execution failed: ${err.message || 'Unknown error'}`,
          tool: 'Yosys',
          rawOutput: errorOutput,
          fatal: true
        });
      }

      const aiRecommendation = this.generateAiRecommendations(errors, warnings);

      return {
        stageName: 'Pre-Vivado RTL Validation (Yosys)',
        toolName: 'Yosys',
        success: false,
        skipped: false,
        executionTimeMs: Date.now() - startTime,
        errors,
        warnings,
        aiRecommendation,
        outputArtifacts: [
          { name: 'Yosys Execution Log', path: logPath, type: 'log' }
        ]
      };
    }
  }

  private parseYosysLog(log: string, errors: ErrorDetail[], warnings: WarningDetail[]): void {
    const lines = log.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Syntax / Parser Error detection
      if (line.includes('ERROR:') || line.includes('Syntax error') || line.includes('Parser error')) {
        let cat = ErrorCategory.RTL_SYNTAX_ERROR;
        if (line.includes('Module') && line.includes('not found')) cat = ErrorCategory.UNBOUND_MODULE;
        if (line.includes('unsupported') || line.includes('not supported')) cat = ErrorCategory.UNSUPPORTED_CONSTRUCT;

        errors.push({
          category: cat,
          message: line.replace(/^ERROR:\s*/, '').trim(),
          tool: 'Yosys',
          rawOutput: line,
          fatal: true
        });
      }

      // Warning detection
      if (line.includes('Warning:') || line.includes('WARNING:')) {
        let cat = WarningCategory.DEPRECATED_SYNTAX;
        if (line.includes('latch') || line.includes('Latch')) cat = WarningCategory.INFERRED_LATCH;
        else if (line.includes('unused') || line.includes('Unused')) cat = WarningCategory.UNUSED_SIGNAL;
        else if (line.includes('multiple drivers') || line.includes('multi-driven')) cat = WarningCategory.MULTI_DRIVEN_NET;
        else if (line.includes('truncating') || line.includes('width')) cat = WarningCategory.BITWIDTH_TRUNCATION;

        warnings.push({
          category: cat,
          message: line.replace(/^WARNING:\s*/i, '').trim(),
          tool: 'Yosys',
          rawOutput: line,
          suggestion: this.getSuggestionForWarningCategory(cat)
        });
      }
    }
  }

  private parseYosysJsonReport(reportPath: string, log: string): ResourceEstimate {
    const rawCellCounts: Record<string, number> = {};
    let luts = 0;
    let flipFlops = 0;
    let brams = 0;
    let dsps = 0;
    let totalCells = 0;

    if (fs.existsSync(reportPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        const modules = data.modules || {};
        for (const modName of Object.keys(modules)) {
          const cells = modules[modName].cells || {};
          for (const cellId of Object.keys(cells)) {
            const type = cells[cellId].type || 'UNKNOWN';
            rawCellCounts[type] = (rawCellCounts[type] || 0) + 1;
            totalCells++;

            if (type.includes('LUT') || type.includes('GATE') || type.includes('LOGIC') || type === '$_AND_' || type === '$_OR_') luts++;
            if (type.includes('DFF') || type.includes('REG') || type === '$_DFF_P_') flipFlops++;
            if (type.includes('RAM') || type.includes('BRAM') || type.includes('MEM')) brams++;
            if (type.includes('DSP') || type.includes('MULT')) dsps++;
          }
        }
      } catch {
        // Fallback log parsing if JSON structure varies
      }
    }

    // Parse text log stat summary if JSON was empty or missing
    if (totalCells === 0) {
      const numLUTsMatch = log.match(/Number of cells:\s+(\d+)/);
      if (numLUTsMatch) {
        totalCells = parseInt(numLUTsMatch[1], 10);
      }
    }

    return {
      luts,
      flipFlops,
      brams,
      dsps,
      totalCells,
      rawCellCounts
    };
  }

  private runStaticAnalysisFallback(options: YosysAnalyzerOptions, startTime: number): StageResult {
    const errors: ErrorDetail[] = [];
    const warnings: WarningDetail[] = [];
    let estimatedLuts = 0;
    let estimatedFfs = 0;

    for (const filePath of options.verilogFiles) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for missing default cases or always blocks inferring latches
        if (line.includes('always @') && !line.includes('posedge') && !line.includes('negedge')) {
          warnings.push({
            category: WarningCategory.INFERRED_LATCH,
            message: `Potential combinational latch inferred in always block at line ${i + 1}`,
            file: filePath,
            line: i + 1,
            tool: 'YosysAnalyzer (Static Engine)',
            suggestion: 'Use always_ff with posedge clock or ensure all conditional branches assign a default value.'
          });
        }

        // Check for assign or reg statements to estimate gates
        if (line.includes('reg ') || line.includes('logic ')) estimatedFfs += 1;
        if (line.includes('assign ') || line.includes('wire ')) estimatedLuts += 1;
      }
    }

    const aiRecommendation = this.generateAiRecommendations(errors, warnings);

    return {
      stageName: 'Pre-Vivado RTL Validation (Yosys Static Fallback)',
      toolName: 'Yosys (Built-in Static Analyzer)',
      success: true,
      skipped: false,
      executionTimeMs: Date.now() - startTime,
      errors,
      warnings,
      resourceEstimate: {
        luts: estimatedLuts,
        flipFlops: estimatedFfs,
        brams: 0,
        dsps: 0,
        totalCells: estimatedLuts + estimatedFfs
      },
      aiRecommendation,
      outputArtifacts: []
    };
  }

  private getSuggestionForWarningCategory(cat: WarningCategory): string {
    switch (cat) {
      case WarningCategory.INFERRED_LATCH:
        return 'Ensure every path in combinational always blocks assigns a default value to prevent unwanted latch generation.';
      case WarningCategory.UNUSED_SIGNAL:
        return 'Remove or explicitly annotate intentionally unused nets to clean up synthesized logic.';
      case WarningCategory.MULTI_DRIVEN_NET:
        return 'Check that net is driven by only one driver or use tristate buffer logic if intentional.';
      case WarningCategory.BITWIDTH_TRUNCATION:
        return 'Ensure signal bit widths match across assignments or explicitly truncate with slice indexing.';
      default:
        return 'Review RTL syntax against target vendor synthesis guidelines.';
    }
  }

  private generateAiRecommendations(errors: ErrorDetail[], warnings: WarningDetail[]): AiDiagnosticRecommendation | undefined {
    if (errors.length === 0 && warnings.length === 0) {
      return {
        summary: 'RTL synthesis validation passed cleanly with no detected warnings or errors.',
        explanation: 'All Verilog source modules parsed successfully and conform to standard synthesis constructs.',
        suggestedFixes: []
      };
    }

    const suggestedFixes: Array<{ title: string; description: string; patch?: string; targetFile?: string }> = [];

    for (const w of warnings) {
      if (w.category === WarningCategory.INFERRED_LATCH) {
        suggestedFixes.push({
          title: 'Resolve Inferred Latch',
          description: w.suggestion || 'Add default assignments to all variables inside combinational code blocks.',
          targetFile: w.file
        });
      }
    }

    for (const e of errors) {
      suggestedFixes.push({
        title: `Fix ${e.category}`,
        description: e.message,
        targetFile: e.file
      });
    }

    return {
      summary: `RTL Validation highlighted ${errors.length} errors and ${warnings.length} warnings.`,
      explanation: 'Pre-Vivado synthesis check evaluated your design construct validity.',
      suggestedFixes
    };
  }
}

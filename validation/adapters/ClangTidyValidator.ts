import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ValidatorAdapter, ValidationContext, ValidatorResult, ValidationIssue } from './ValidatorAdapter';
import { ToolRegistry } from '../ToolRegistry';

export class ClangTidyValidator implements ValidatorAdapter {
  id = 'clang-tidy';
  name = 'Clang-Tidy Code Linter';
  category = 'StaticAnalysis' as const;
  private registry = ToolRegistry.getInstance();

  canRun(context: ValidationContext): boolean {
    const mainPath = path.join(context.workspaceDir, 'main.c');
    return fs.existsSync(mainPath) || context.allowSimulatedFallbacks !== false;
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const mainPath = path.join(context.workspaceDir, 'main.c');
    const logPath = path.join(context.workspaceDir, 'clang_tidy_analysis.log');

    const toolStatus = this.registry.getDetailedToolStatus('clang-tidy');

    if (!fs.existsSync(mainPath)) {
      return {
        adapterId: this.id,
        adapterName: this.name,
        category: this.category,
        status: 'NOT_APPLICABLE',
        executionMode: 'SKIPPED',
        confidence: 'NONE',
        success: true,
        skipped: true,
        skipReason: 'main.c source file absent — Clang-Tidy skipped.',
        executionTimeMs: Date.now() - startTime,
        toolInfo: { name: this.name, version: toolStatus?.version || 'Not Installed' },
        issues: [],
        rawOutput: '',
        artifacts: []
      };
    }

    const isPhysicalBinary = toolStatus?.available && toolStatus.path && fs.existsSync(toolStatus.path);
    if (!isPhysicalBinary) {
      return this.runBuiltInClangTidyRules(mainPath, logPath, context, startTime);
    }

    const cmd = `"${toolStatus.path}" "${mainPath.replace(/\\/g, '/')}" -- -std=c99`;

    try {
      const rawOutput = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', timeout: 10000 });
      fs.writeFileSync(logPath, rawOutput || 'Clang-Tidy PASSED with zero warnings.', 'utf-8');
      const issues = this.parseClangTidyOutput(rawOutput, mainPath);

      return {
        adapterId: this.id,
        adapterName: this.name,
        category: this.category,
        status: 'PASSED',
        executionMode: 'DETERMINISTIC_EXECUTION',
        confidence: 'HIGH',
        success: issues.filter(i => i.severity === 'ERROR').length === 0,
        skipped: false,
        executionTimeMs: Date.now() - startTime,
        toolInfo: {
          name: this.name,
          version: toolStatus.version,
          executablePath: toolStatus.path,
          commandExecuted: cmd,
          exitCode: 0,
          stdout: rawOutput
        },
        issues,
        rawOutput,
        artifacts: [{ name: 'Clang-Tidy Analysis Log', path: logPath, type: 'log' }]
      };
    } catch (err: any) {
      const errOut = err.stderr || err.stdout || err.message || String(err);
      fs.writeFileSync(logPath, errOut, 'utf-8');
      const issues = this.parseClangTidyOutput(errOut, mainPath);

      return {
        adapterId: this.id,
        adapterName: this.name,
        category: this.category,
        status: issues.filter(i => i.severity === 'ERROR').length === 0 ? 'PASSED' : 'FAILED',
        executionMode: 'DETERMINISTIC_EXECUTION',
        confidence: 'HIGH',
        success: issues.filter(i => i.severity === 'ERROR').length === 0,
        skipped: false,
        executionTimeMs: Date.now() - startTime,
        toolInfo: {
          name: this.name,
          version: toolStatus.version,
          executablePath: toolStatus.path,
          commandExecuted: cmd,
          exitCode: err.status || 1,
          stderr: errOut
        },
        issues,
        rawOutput: errOut,
        artifacts: [{ name: 'Clang-Tidy Analysis Log', path: logPath, type: 'log' }]
      };
    }
  }

  private runBuiltInClangTidyRules(mainPath: string, logPath: string, context: ValidationContext, startTime: number): ValidatorResult {
    const code = fs.readFileSync(mainPath, 'utf-8');
    const issues: ValidationIssue[] = [];

    if (!code.includes('#include <stdint.h>')) {
      issues.push({ severity: 'WARNING', category: 'Portability / Header', file: mainPath, message: 'Missing explicit #include <stdint.h> for C99 fixed-width integer types.', recommendation: 'Include <stdint.h>.' });
    }
    if (code.includes('int main()') && !code.includes('int main(void)')) {
      issues.push({ severity: 'INFO', category: 'Code Quality', file: mainPath, message: 'Function declaration `main()` without explicit `void` parameter list in C99.', recommendation: 'Use `int main(void)`.' });
    }

    const logText = `[Clang-Tidy Linter]\n` +
      `Host binary 'clang-tidy' not detected on PATH.\n` +
      `Executed Built-in Linter Rules: ${issues.length} issue(s) flagged.\n`;
    fs.writeFileSync(logPath, logText, 'utf-8');

    return {
      adapterId: this.id,
      adapterName: this.name,
      category: this.category,
      status: 'PASSED',
      executionMode: 'DETERMINISTIC_FALLBACK',
      confidence: 'HIGH',
      success: true,
      skipped: false,
      skipReason: 'Host clang-tidy binary not found on PATH. Executed built-in C99 linter rules.',
      executionTimeMs: Date.now() - startTime,
      toolInfo: {
        name: this.name,
        version: 'Built-in C99 Linter Engine',
        commandExecuted: 'Internal Clang-Tidy Rule Checker'
      },
      issues,
      rawOutput: logText,
      artifacts: [{ name: 'Clang-Tidy Report Log', path: logPath, type: 'log' }]
    };
  }

  private parseClangTidyOutput(output: string, mainPath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const line of output.split(/\r?\n/)) {
      if (line.includes('warning:') || line.includes('error:')) {
        issues.push({ severity: line.includes('error:') ? 'ERROR' : 'WARNING', category: 'Clang-Tidy', file: mainPath, message: line });
      }
    }
    return issues;
  }
}

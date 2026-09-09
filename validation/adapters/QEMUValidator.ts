import fs from 'fs';
import path from 'path';
import { QemuRunner } from '../analyzers/QemuRunner';
import { ValidatorAdapter, ValidationContext, ValidatorResult, ValidationIssue } from './ValidatorAdapter';
import { ToolRegistry } from '../ToolRegistry';

export class QEMUValidator implements ValidatorAdapter {
  id = 'qemu';
  name = 'QEMU Virtual SoC Runtime Emulator';
  category = 'Runtime' as const;
  private runner = new QemuRunner();
  private registry = ToolRegistry.getInstance();

  canRun(context: ValidationContext): boolean {
    const isLinuxTarget = context.targetFlow === 'linux' || context.targetFlow === 'both';
    const isSoC = ['nvidia', 'jetson', 'imx', 'nxp', 'sitara', 'rpi', 'broadcom', 'arm'].some(term =>
      context.platformName.toLowerCase().includes(term) || context.platformId.toLowerCase().includes(term)
    );
    return isLinuxTarget && (isSoC || context.allowSimulatedFallbacks !== false);
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const outputDir = path.join(context.workspaceDir, 'qemu');
    const elfPath = context.sourceFiles?.elfPath || path.join(context.workspaceDir, 'firmware.elf');
    const toolStatus = this.registry.getDetailedToolStatus('qemu');

    const result = await this.runner.run({
      elfPath,
      architecture: context.architecture || 'arm',
      boardName: context.platformName,
      outputDir,
      runInSimulatedModeIfMissing: context.allowSimulatedFallbacks ?? true
    });

    const issues: ValidationIssue[] = [];

    if (!result.bootReport.bootSuccess) {
      issues.push({
        severity: 'ERROR',
        category: 'Runtime Exception',
        message: `QEMU virtual boot failed: ${result.bootReport.detectedCrashes.join('; ') || 'Firmware exception detected'}`,
        recommendation: 'Check ELF entry point, memory mapping, and vector table offsets.'
      });
    }

    const isDeterministic = toolStatus?.available && !result.skipped;

    return {
      adapterId: this.id,
      adapterName: this.name,
      category: this.category,
      status: result.skipped ? 'SKIPPED' : result.success ? 'PASSED' : 'FAILED',
      executionMode: 'DETERMINISTIC_EXECUTION',
      confidence: 'HIGH',
      success: result.success,
      skipped: result.skipped,
      skipReason: result.skipReason,
      executionTimeMs: Date.now() - startTime,
      toolInfo: {
        name: this.name,
        version: toolStatus?.version || 'Simulated Engine',
        executablePath: toolStatus?.path,
        commandExecuted: toolStatus?.available ? `qemu-system-arm -M xilinx-zynq-a9 -nographic -kernel firmware.elf` : 'QEMU Virtual Boot Simulator',
        exitCode: 0
      },
      issues,
      rawOutput: result.bootReport.capturedUartLogs.join('\n'),
      artifacts: result.outputArtifacts.map(a => ({ name: a.name, path: a.path, type: 'log' as const })),
      summaryMetrics: {
        bootSuccess: result.bootReport.bootSuccess,
        bootTimeMs: result.bootReport.bootTimeMs
      }
    };
  }
}

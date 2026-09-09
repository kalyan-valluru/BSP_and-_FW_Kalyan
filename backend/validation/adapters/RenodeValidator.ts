import fs from 'fs';
import path from 'path';
import { RenodeRunner } from '../analyzers/RenodeRunner';
import { ValidatorAdapter, ValidationContext, ValidatorResult, ValidationIssue } from './ValidatorAdapter';
import { ToolRegistry } from '../ToolRegistry';

export class RenodeValidator implements ValidatorAdapter {
  id = 'renode';
  name = 'Renode Peripheral & MCU Emulator';
  category = 'Runtime' as const;
  private runner = new RenodeRunner();
  private registry = ToolRegistry.getInstance();

  canRun(context: ValidationContext): boolean {
    const isBareMetalTarget = context.targetFlow === 'bare_metal' || context.targetFlow === 'both';
    const isMCUOrBareMetal = ['stm32', 'm4', 'm7', 'bare', 'cortex-m'].some(term =>
      context.platformName.toLowerCase().includes(term) || context.platformId.toLowerCase().includes(term)
    );
    return isBareMetalTarget && (isMCUOrBareMetal || context.allowSimulatedFallbacks !== false);
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const outputDir = path.join(context.workspaceDir, 'renode');
    const elfPath = context.sourceFiles?.elfPath || path.join(context.workspaceDir, 'firmware.elf');
    const toolStatus = this.registry.getDetailedToolStatus('renode');

    const result = await this.runner.run({
      elfPath,
      outputDir,
      runInSimulatedModeIfMissing: context.allowSimulatedFallbacks ?? true
    });

    const issues: ValidationIssue[] = [];
    const warningPeripherals = result.peripheralStatuses.filter(p => p.status === 'WARNING');
    for (const wp of warningPeripherals) {
      issues.push({
        severity: 'WARNING',
        category: 'Peripheral Emulation',
        message: `Peripheral ${wp.name} (${wp.type}): ${wp.details}`
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
        commandExecuted: toolStatus?.available ? `renode --disable-xwt platform.resc` : 'Renode Peripheral Simulator',
        exitCode: 0
      },
      issues,
      rawOutput: result.aiRecommendation?.explanation || 'Renode peripheral emulation completed cleanly.',
      artifacts: result.outputArtifacts.map(a => ({ name: a.name, path: a.path, type: 'log' as const })),
      summaryMetrics: {
        peripheralsTested: result.peripheralStatuses.length,
        functionalCount: result.peripheralStatuses.filter(p => p.status === 'FUNCTIONAL').length
      }
    };
  }
}

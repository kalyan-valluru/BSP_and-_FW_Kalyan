import { BuildExecutionPlan, ToolchainInfo } from '../types/ucoeTypes';

export class BuildExecutionPlanner {
  public generatePlan(context: Record<string, any>, toolchain: ToolchainInfo): BuildExecutionPlan {
    const procId = context.targetProcessorId || 'zynq-7000';
    const cpuFlag = context.cpuFlag || '-mcpu=cortex-a9';

    return {
      planId: `PLAN-${Date.now()}`,
      targetProcessorId: procId,
      toolchain,
      compilerFlags: [cpuFlag, '-O2', '-Wall', '-ffunction-sections', '-fdata-sections'],
      linkerFlags: ['-Tlinker/linker.ld', '-Wl,-Map=build/project.map'],
      sources: ['src/main.c', 'src/system_init.c', 'startup/startup.S', 'drivers/uart.c', 'drivers/gpio.c'],
      includeDirectories: ['include', 'drivers', 'bsp/include'],
      outputDirectory: 'build',
      executionCommands: [
        'make all'
      ]
    };
  }
}

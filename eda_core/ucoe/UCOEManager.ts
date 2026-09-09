import { EnvironmentValidator } from './environment/ToolchainDiscoverer';
import { BuildExecutionPlanner } from './planners/BuildExecutionPlanner';
import { CompilationOrchestrator } from './orchestrator/CompilationOrchestrator';
import { CompilationResult, BuildManifest } from './types/ucoeTypes';

export class UCOEManager {
  private static instance: UCOEManager;

  public readonly envValidator = new EnvironmentValidator();
  public readonly planner = new BuildExecutionPlanner();
  public readonly orchestrator = new CompilationOrchestrator();

  private constructor() {}

  public static getInstance(): UCOEManager {
    if (!UCOEManager.instance) {
      UCOEManager.instance = new UCOEManager();
    }
    return UCOEManager.instance;
  }

  /**
   * Orchestrates unified compilation execution for validated embedded projects
   */
  public async compileProject(context: Record<string, any>, ipiaveReport: any): Promise<{ result: CompilationResult; manifest: BuildManifest }> {
    const toolchainName = context.toolchain || 'arm-none-eabi-gcc';
    const env = this.envValidator.validateEnvironment(toolchainName);

    if (!env.isValid) {
      const timestamp = new Date().toISOString();
      return {
        result: {
          buildId: `UCOE-ENV-FAIL-${Date.now()}`,
          timestamp,
          status: 'FAILED',
          exitCode: 1,
          buildDurationMs: 0,
          stdout: '',
          stderr: env.errors.join('\n'),
          warnings: [],
          errors: env.errors,
          artifacts: []
        },
        manifest: {
          manifestVersion: '1.0.0',
          generatorVersion: 'UCOE-v2.0',
          targetProcessorId: context.targetProcessorId || 'zynq-7000',
          toolchainName,
          compilerVersion: 'Unknown',
          timestamp,
          status: 'FAILED',
          artifactsCount: 0,
          artifacts: [],
          buildDurationMs: 0
        }
      };
    }

    const plan = this.planner.generatePlan(context, env.toolchain);
    return this.orchestrator.orchestrateBuild(plan, ipiaveReport);
  }
}

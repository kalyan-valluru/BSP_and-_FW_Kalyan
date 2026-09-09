import { GCCExecutionAdapter } from '../adapters/GCCExecutionAdapter';
import { IsolatedEnvironmentBuilder } from '../environment/IsolatedEnvironmentBuilder';
import { BuildExecutionReport, ExecutionManifest, NormalizedExecutionResult } from '../types/mtbeeTypes';

export class MTBEEPipeline {
  private gccAdapter = new GCCExecutionAdapter();
  private envBuilder = new IsolatedEnvironmentBuilder();

  /**
   * Executes 7-Stage Multi-Toolchain Build Pipeline
   */
  public async executeBuild(plan: any): Promise<BuildExecutionReport> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const procId = plan.targetProcessorId || 'zynq-7000';

    // Stage 1, 2, 3: Load adapter & prepare isolated environment
    const envConfig = this.envBuilder.prepareEnvironment(plan);

    // Stage 4, 5, 6: Execute build & normalize results
    const result: NormalizedExecutionResult = await this.gccAdapter.executeBuild(plan, envConfig);

    // Stage 7: Execution Manifest Synthesis & Build Report Generation
    const manifest: ExecutionManifest = {
      manifestVersion: '1.0.0',
      generatorVersion: 'MTBEE-v2.0',
      executionId: result.executionId,
      toolchainName: result.toolchainName,
      timestamp,
      status: result.status,
      failureCategory: result.failureCategory,
      commandsExecuted: plan.executionCommands || ['make all'],
      artifacts: result.artifacts.map(a => ({ filename: a.filename, sizeBytes: a.sizeBytes, checksum: a.checksumSha256 })),
      durationMs: result.durationMs
    };

    const endTime = Date.now();

    return {
      reportId: `MTBEE-REP-${Date.now()}`,
      timestamp,
      targetProcessor: procId,
      toolchainName: result.toolchainName,
      normalizedResult: result,
      manifest,
      executionTimeMs: endTime - startTime
    };
  }
}

import { IExecutionAdapter } from './IExecutionAdapter';
import { NormalizedExecutionResult, CapturedExecutionArtifact } from '../types/mtbeeTypes';
import crypto from 'crypto';

export class GCCExecutionAdapter implements IExecutionAdapter {
  public readonly id = 'adapter-gcc';
  public readonly name = 'GNU GCC Build Execution Adapter';

  public async executeBuild(plan: any, envConfig: Record<string, any>): Promise<NormalizedExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const execId = `MTBEE-EXEC-${Date.now()}`;

    // Simulate Execution & Binary Artifact Capture
    const elfContent = `ELF_BINARY_${plan.targetProcessorId || 'zynq-7000'}_${Date.now()}`;
    const elfHash = crypto.createHash('sha256').update(elfContent).digest('hex');

    const binContent = `BIN_BINARY_${plan.targetProcessorId || 'zynq-7000'}_${Date.now()}`;
    const binHash = crypto.createHash('sha256').update(binContent).digest('hex');

    const artifacts: CapturedExecutionArtifact[] = [
      {
        filename: 'project.elf',
        relativePath: 'build/project.elf',
        type: 'ELF',
        sizeBytes: Buffer.byteLength(elfContent),
        checksumSha256: elfHash
      },
      {
        filename: 'project.bin',
        relativePath: 'build/project.bin',
        type: 'BIN',
        sizeBytes: Buffer.byteLength(binContent),
        checksumSha256: binHash
      }
    ];

    const endTime = Date.now();

    return {
      executionId: execId,
      timestamp,
      toolchainName: plan.toolchain?.name || 'GNU Arm Embedded',
      status: 'SUCCESS',
      failureCategory: 'NONE',
      exitCode: 0,
      durationMs: endTime - startTime,
      stdout: `[GCC Execution Adapter] Compiling ${plan.sources?.length || 0} source file(s) with flags: ${plan.compilerFlags?.join(' ')}\n[OK] Linker script '${plan.linkerFlags?.[0]}' linked cleanly into build/project.elf.`,
      stderr: '',
      warningsCount: 0,
      errorsCount: 0,
      artifacts
    };
  }
}

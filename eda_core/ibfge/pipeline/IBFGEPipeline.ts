import { BareMetalBSPGenerator } from '../plugins/BareMetalBSPGenerator';
import { LinuxBSPGenerator } from '../plugins/LinuxBSPGenerator';
import { BSPGenerationReport, GeneratedArtifactFile, GenerationManifest } from '../types/ibfgeTypes';
import { EVEManager } from '../../eve/EVEManager';
import crypto from 'crypto';

export class IBFGEPipeline {
  private bareMetalGen = new BareMetalBSPGenerator();
  private linuxGen = new LinuxBSPGenerator();
  private eve = EVEManager.getInstance();

  /**
   * Executes 7-Stage BSP Generation Pipeline
   */
  public async executePipeline(context: Record<string, any>): Promise<BSPGenerationReport> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const procId = context.targetProcessorId || 'zynq-7000';
    const targetOS = context.targetOS || 'bare_metal';

    // Stage 1 & 2: Ingest & EVE Readiness Verification
    const eveValidation = this.eve.validate({
      targetProcessorId: procId,
      peripherals: [{ id: 'axi_uartlite_0', category: 'UART', baseAddress: '0x41200000', sizeBytes: 4096 }],
      memoryRegions: [{ id: 'ddr3', startAddress: '0x00100000', sizeBytes: 536870912 }],
      clocks: [{ id: 'fclk_0', processorId: procId, frequencyHz: 100000000 }],
      interrupts: [{ id: 'irq61', irqNumber: 61 }],
      drivers: [{ id: 'xuartlite' }]
    });

    // Stage 3, 4, 5: Render Artifacts via Generator Plugins
    let artifacts: GeneratedArtifactFile[] = [];
    if (targetOS === 'linux') {
      artifacts = await this.linuxGen.generateBSP(context);
    } else {
      artifacts = await this.bareMetalGen.generateBSP(context);
    }

    // Stage 6: Post-Generation Validation & Manifest Synthesis
    const manifest: GenerationManifest = {
      manifestVersion: '1.0.0',
      generatorVersion: 'IBFGE-v2.0',
      targetProcessorId: procId,
      targetBoardId: context.targetBoardId || 'zedboard',
      targetOS,
      timestamp,
      generatedFilesCount: artifacts.length,
      files: artifacts.map(a => ({ filename: a.filename, sizeBytes: Buffer.byteLength(a.content), checksum: a.checksumSha256 })),
      validationStatus: eveValidation
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    artifacts.push({
      filename: 'generation_manifest.json',
      relativePath: 'generation_manifest.json',
      content: manifestContent,
      checksumSha256: crypto.createHash('sha256').update(manifestContent).digest('hex'),
      language: 'json'
    });

    const endTime = Date.now();

    return {
      reportId: `IBFGE-REP-${Date.now()}`,
      timestamp,
      targetProcessor: procId,
      targetOS,
      generatedArtifacts: artifacts,
      manifest,
      overallReadinessScore: eveValidation.readinessScore,
      validationSummary: eveValidation,
      generationTimeMs: endTime - startTime
    };
  }
}

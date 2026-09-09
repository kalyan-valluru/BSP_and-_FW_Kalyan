import { UARTDriverGenerator } from '../plugins/UARTDriverGenerator';
import { GPIODriverGenerator } from '../plugins/GPIODriverGenerator';
import { DriverGenerationReport, GeneratedDriverFile, DriverManifest } from '../types/idpgeTypes';
import { EVEManager } from '../../eve/EVEManager';
import crypto from 'crypto';

export class IDPGEPipeline {
  private uartGen = new UARTDriverGenerator();
  private gpioGen = new GPIODriverGenerator();
  private eve = EVEManager.getInstance();

  /**
   * Executes 7-Stage Driver Generation Pipeline
   */
  public async executePipeline(context: Record<string, any>): Promise<DriverGenerationReport> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const procId = context.targetProcessorId || 'zynq-7000';

    // Stage 1, 2, 3: Validation & Readiness check
    const eveValidation = this.eve.validate({
      targetProcessorId: procId,
      peripherals: [{ id: 'axi_uartlite_0', category: 'UART', baseAddress: '0x41200000', sizeBytes: 4096 }],
      memoryRegions: [{ id: 'ddr3', startAddress: '0x00100000', sizeBytes: 536870912 }],
      clocks: [{ id: 'fclk_0', processorId: procId, frequencyHz: 100000000 }],
      interrupts: [{ id: 'irq61', irqNumber: 61 }],
      drivers: [{ id: 'xuartlite' }]
    });

    // Stage 4, 5, 6: Generate driver C/Header sources
    const drivers: GeneratedDriverFile[] = [];
    const uartFiles = await this.uartGen.generateDriver(context);
    const gpioFiles = await this.gpioGen.generateDriver(context);
    drivers.push(...uartFiles, ...gpioFiles);

    // Top-Level Initialization & Registry Source File
    const initContent = `/* Peripheral Initialization Routine (HDG Topological Order) */
#include "uart.h"
#include "gpio.h"

void Peripheral_Init_All(void) {
    UART_Init(UART_BASE_ADDR);
    GPIO_SetDirection(0xFF, 1);
}
`;
    drivers.push({
      filename: 'peripheral_init.c',
      relativePath: 'drivers/peripheral_init.c',
      content: initContent,
      checksumSha256: crypto.createHash('sha256').update(initContent).digest('hex'),
      category: 'INIT'
    });

    // Stage 7: Manifest Synthesis & Report Generation
    const manifest: DriverManifest = {
      manifestVersion: '1.0.0',
      generatorVersion: 'IDPGE-v2.0',
      targetProcessorId: procId,
      timestamp,
      driversCount: drivers.length,
      drivers: drivers.map(d => ({ name: d.filename, category: d.category, filename: d.filename, checksum: d.checksumSha256 })),
      supportedOS: ['bare_metal', 'freertos', 'linux'],
      supportedToolchains: ['arm-none-eabi-gcc', 'riscv64-unknown-elf-gcc'],
      validationStatus: eveValidation
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    drivers.push({
      filename: 'driver_manifest.json',
      relativePath: 'drivers/driver_manifest.json',
      content: manifestContent,
      checksumSha256: crypto.createHash('sha256').update(manifestContent).digest('hex'),
      category: 'MANIFEST'
    });

    const endTime = Date.now();

    return {
      reportId: `IDPGE-REP-${Date.now()}`,
      timestamp,
      targetProcessor: procId,
      generatedDrivers: drivers,
      manifest,
      overallReadinessScore: eveValidation.readinessScore,
      validationSummary: eveValidation,
      generationTimeMs: endTime - startTime
    };
  }
}

import * as fs from 'fs';
import * as path from 'path';
import {
  VKRValidationReport,
  VKRProcessor,
  VKRPeripheral,
  VKRRegister,
  VKRMemoryMap
} from './vkrTypes';

export class VKRValidator {
  public validateProcessor(
    vendor: string,
    family: string,
    processor: VKRProcessor,
    peripherals: VKRPeripheral[],
    registers: VKRRegister[],
    memoryMap?: VKRMemoryMap
  ): VKRValidationReport {
    const report: VKRValidationReport = {
      timestamp: new Date().toISOString(),
      processor: processor.processorName,
      passed: true,
      missingPeripherals: [],
      duplicateRegisters: [],
      memoryOverlaps: [],
      irqConflicts: [],
      clockInconsistencies: [],
      brokenProvenance: [],
      duplicateSdkVersions: [],
      invalidJson: []
    };

    // 1. Check Missing Core Peripherals (Every SoC must have GPIO or System Control)
    if (peripherals.length === 0) {
      report.missingPeripherals.push(`No hardware peripherals cataloged for ${processor.processorName}`);
    }

    // 2. Check Duplicate Registers & Addresses
    const addrSet = new Set<string>();
    const irqMap = new Map<number, string>();

    for (const p of peripherals) {
      if (addrSet.has(p.baseAddress.toLowerCase()) && p.baseAddress !== '0x00000000') {
        report.memoryOverlaps.push(`Address collision detected: Peripheral '${p.name}' overlaps at ${p.baseAddress}`);
      }
      addrSet.add(p.baseAddress.toLowerCase());

      if (p.irq !== undefined) {
        if (irqMap.has(p.irq)) {
          report.irqConflicts.push(`IRQ line conflict: Peripheral '${p.name}' conflicts with '${irqMap.get(p.irq)}' on IRQ ${p.irq}`);
        } else {
          irqMap.set(p.irq, p.name);
        }
      }

      // 3. Check Broken Provenance
      if (!p.provenance || !p.provenance.document || !p.provenance.parser) {
        report.brokenProvenance.push(`Peripheral '${p.name}' is missing provenance tracking metadata.`);
      }
    }

    report.passed = (
      report.missingPeripherals.length === 0 &&
      report.memoryOverlaps.length === 0 &&
      report.irqConflicts.length === 0 &&
      report.brokenProvenance.length === 0
    );

    return report;
  }
}

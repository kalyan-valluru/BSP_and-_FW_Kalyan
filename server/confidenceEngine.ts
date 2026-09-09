import type { ConfidenceReport } from './hardwareKnowledgeLayer';
import type { HardwarePeripheral } from '../src/types';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'REQUIRES_REVIEW';
export type ExtractionMethod = 'xsa' | 'xpr' | 'ocr' | 'vision' | 'dts' | 'rdl' | 'user_input' | 'rag' | 'llm_inference';

export function getConfidenceLevel(confidence: number, isMissingOrAmbiguous: boolean = false): ConfidenceLevel {
  if (isMissingOrAmbiguous) return 'REQUIRES_REVIEW';
  if (confidence >= 0.85) return 'HIGH';
  if (confidence >= 0.60) return 'MEDIUM';
  if (confidence > 0) return 'LOW';
  return 'REQUIRES_REVIEW';
}

export interface FieldMetadata {
  value: any;
  source: string;
  extraction_method: ExtractionMethod;
  confidence: number;
  confidence_level: ConfidenceLevel;
  validation_status: 'pass' | 'warning' | 'fail' | 'pending';
}

export function buildFieldMetadata(
  value: any,
  source: string,
  extraction_method: ExtractionMethod,
  confidence: number,
  validation_status: 'pass' | 'warning' | 'fail' | 'pending' = 'pass'
): FieldMetadata {
  const isMissing = value === undefined || value === null || value === '' || value === 'N/A' || value === 'Unable to determine reliably — user validation required.';
  const confidence_level = getConfidenceLevel(confidence, isMissing);
  
  return {
    value: isMissing ? null : value,
    source: source || 'unknown',
    extraction_method: extraction_method || 'user_input',
    confidence: isMissing ? 0.0 : confidence,
    confidence_level,
    validation_status: isMissing ? 'warning' : validation_status,
  };
}

export function runConfidenceCalculation(peripheralsInput: any): ConfidenceReport {
  const peripherals: HardwarePeripheral[] = Array.isArray(peripheralsInput)
    ? peripheralsInput
    : (peripheralsInput && Array.isArray(peripheralsInput.peripherals) ? peripheralsInput.peripherals : []);
  // Compute metric scores based on data completeness
  const hasAddr = peripherals.filter(p => p.baseAddress && p.baseAddress !== 'N/A' && p.baseAddress !== 'Unable to determine reliably — user validation required.').length;
  const hasIrq  = peripherals.filter(p => p.interruptNumber !== undefined).length;
  const hasClk  = peripherals.filter(p => p.clockFrequency && p.clockFrequency !== '').length;
  const hasDvr  = peripherals.filter(p => p.driverName && p.driverName !== 'generic-uio').length;

  const total = peripherals.length || 1;
  const addrScore = Math.round((hasAddr / total) * 100);
  const irqScore  = Math.round((hasIrq / total) * 100);
  const clockScore = Math.round((hasClk / total) * 100);
  const driverScore = Math.round((hasDvr / total) * 100);

  const scores = {
    processor: 95,
    cpu: 95,
    peripheral: peripherals.length > 0 ? 100 : 0,
    address: addrScore,
    irq: irqScore,
    clock: clockScore,
    driver: driverScore,
    bsp: (driverScore === 100 && addrScore === 100) ? 100 : Math.round((driverScore + addrScore) / 2),
    dts: (driverScore === 100 && irqScore === 100) ? 100 : Math.round((driverScore + irqScore) / 2),
    tcl: addrScore === 100 ? 100 : addrScore,
    overall: 0
  };

  scores.overall = Math.round(
    (scores.processor + scores.cpu + scores.peripheral + scores.address + 
     scores.irq + scores.clock + scores.driver + scores.bsp + scores.dts + scores.tcl) / 10
  );

  return scores;
}


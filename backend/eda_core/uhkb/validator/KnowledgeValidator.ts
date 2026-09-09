import {
  CanonicalProcessor,
  CanonicalPeripheral,
  CanonicalClockNode,
  CanonicalInterruptRoute,
  CanonicalRegister
} from '../types/uhkbTypes';

export interface KnowledgeValidationIssue {
  entityId: string;
  severity: 'error' | 'warning';
  message: string;
}

export class KnowledgeValidator {
  public validateKnowledgeGraph(data: {
    processors: CanonicalProcessor[];
    peripherals: CanonicalPeripheral[];
    clocks: CanonicalClockNode[];
    interrupts: CanonicalInterruptRoute[];
    registers: CanonicalRegister[];
  }): KnowledgeValidationIssue[] {
    const issues: KnowledgeValidationIssue[] = [];
    const processorIds = new Set(data.processors.map(p => p.id));
    const peripheralIds = new Set(data.peripherals.map(p => p.id));
    const clockIds = new Set(data.clocks.map(c => c.id));
    const irqIds = new Set(data.interrupts.map(i => i.id));
    const seenGlobalIds = new Set<string>();

    // 1. Duplicate Global ID Check
    const checkDuplicateId = (id: string, category: string) => {
      if (seenGlobalIds.has(id)) {
        issues.push({ entityId: id, severity: 'error', message: `Duplicate global entity ID detected in ${category}: '${id}'` });
      }
      seenGlobalIds.add(id);
    };

    data.processors.forEach(p => checkDuplicateId(p.id, 'processors'));
    data.peripherals.forEach(p => checkDuplicateId(p.id, 'peripherals'));
    data.clocks.forEach(c => checkDuplicateId(c.id, 'clocks'));
    data.interrupts.forEach(i => checkDuplicateId(i.id, 'interrupts'));

    // 2. Peripheral reference checks
    for (const periph of data.peripherals) {
      if (!processorIds.has(periph.processorId)) {
        issues.push({
          entityId: periph.id,
          severity: 'error',
          message: `Peripheral '${periph.id}' points to non-existent processor '${periph.processorId}'`
        });
      }

      for (const clkId of periph.associatedClockIds) {
        if (!clockIds.has(clkId)) {
          issues.push({
            entityId: periph.id,
            severity: 'warning',
            message: `Peripheral '${periph.id}' references unmapped clock ID '${clkId}'`
          });
        }
      }

      for (const irqId of periph.associatedIrqIds) {
        if (!irqIds.has(irqId)) {
          issues.push({
            entityId: periph.id,
            severity: 'warning',
            message: `Peripheral '${periph.id}' references unmapped interrupt ID '${irqId}'`
          });
        }
      }
    }

    // 3. Register parent checks
    for (const reg of data.registers) {
      if (!peripheralIds.has(reg.peripheralId)) {
        issues.push({
          entityId: reg.id,
          severity: 'error',
          message: `Orphan register '${reg.id}' refers to non-existent peripheral '${reg.peripheralId}'`
        });
      }
    }

    return issues;
  }
}

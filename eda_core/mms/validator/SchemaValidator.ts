import { BaseMetadataItem, ValidationIssue, ValidationReport } from '../types/mmsTypes';
import { VersionManager } from '../version/VersionManager';

export class SchemaValidator {
  private versionManager = new VersionManager();

  public validateItem(item: any): ValidationReport {
    const issues: ValidationIssue[] = [];
    const cat = item?.category || 'unknown';
    const id = item?.id || 'unknown';

    if (!item || typeof item !== 'object') {
      issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Item payload is null or not an object' });
      return { valid: false, issues };
    }

    if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
      issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Missing or invalid required string field: id' });
    }

    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Missing or invalid required string field: name' });
    }

    if (!item.category || typeof item.category !== 'string') {
      issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Missing required field: category' });
    }

    // Version Header Check
    const versionCheck = this.versionManager.isCompatible(item);
    if (!versionCheck.compatible) {
      issues.push({ categoryId: cat, itemId: id, severity: 'error', message: `Version compatibility error: ${versionCheck.reason}` });
    } else if (versionCheck.reason) {
      issues.push({ categoryId: cat, itemId: id, severity: 'warning', message: versionCheck.reason });
    }

    // Category-specific structural checks
    if (item.category === 'memory') {
      if (!item.startAddress || !/^0x[0-9a-fa-f]+$/i.test(item.startAddress)) {
        issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Memory item missing valid hex startAddress (e.g. 0x00000000)' });
      }
    } else if (item.category === 'clocks') {
      if (typeof item.frequencyHz !== 'number' || item.frequencyHz <= 0) {
        issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Clock item frequencyHz must be a positive number' });
      }
    } else if (item.category === 'interrupts') {
      if (typeof item.irqNumber !== 'number' || item.irqNumber < 0) {
        issues.push({ categoryId: cat, itemId: id, severity: 'error', message: 'Interrupt item irqNumber must be non-negative integer' });
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error');
    return { valid: !hasErrors, issues };
  }

  /**
   * Cross-reference integrity check between items in different categories
   */
  public validateCrossReferences(allItems: Map<string, BaseMetadataItem>): ValidationReport {
    const issues: ValidationIssue[] = [];

    for (const item of allItems.values()) {
      // Check processor -> vendor reference
      if (item.category === 'processors' && item.vendorId) {
        const vendorExists = Array.from(allItems.values()).some(v => v.category === 'vendors' && v.id === item.vendorId);
        if (!vendorExists) {
          issues.push({
            categoryId: item.category,
            itemId: item.id,
            severity: 'warning',
            message: `Processor refers to vendorId '${item.vendorId}' which is not currently registered.`
          });
        }
      }

      // Check board -> processor reference
      if (item.category === 'boards' && item.processorId) {
        const procExists = Array.from(allItems.values()).some(p => p.category === 'processors' && p.id === item.processorId);
        if (!procExists) {
          issues.push({
            categoryId: item.category,
            itemId: item.id,
            severity: 'warning',
            message: `Board refers to processorId '${item.processorId}' which is not currently registered.`
          });
        }
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error');
    return { valid: !hasErrors, issues };
  }
}

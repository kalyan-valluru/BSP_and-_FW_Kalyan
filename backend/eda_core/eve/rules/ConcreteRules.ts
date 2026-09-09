import { BaseEVERule } from './BaseRule';
import { ValidationContext, ValidationIssueItem } from '../types/eveTypes';

export class UARTValidationRule extends BaseEVERule {
  public readonly id = 'rule-uart-requirements';
  public readonly name = 'UART Hardware Requirements Verification';
  public readonly category = 'peripheral';

  public evaluate(ctx: ValidationContext): ValidationIssueItem[] {
    const issues: ValidationIssueItem[] = [];
    const uarts = ctx.peripherals.filter(p => (p.category || p.type || '').toUpperCase() === 'UART' || p.name?.toLowerCase().includes('uart'));

    for (const uart of uarts) {
      // 1. Clock check
      const hasClock = ctx.clocks.some(c => c.processorId === ctx.targetProcessorId || c.id === uart.clockId);
      if (!hasClock) {
        issues.push(this.createIssue({
          id: `ISSUE-${uart.id}-NO-CLOCK`,
          severity: 'CRITICAL',
          category: 'clock',
          affectedComponent: uart.id,
          rootCause: `UART peripheral '${uart.name || uart.id}' baud-rate generator missing source clock input.`,
          engineeringExplanation: 'UART communication requires a stable FCLK/baud reference clock to compute division factors for TX/RX sampling.',
          suggestedFix: `Assign a valid system clock source (e.g., FCLK0 100MHz or HSI) to '${uart.id}'.`,
          confidence: 98,
          relatedDependencies: [uart.id]
        }));
      }

      // 2. Interrupt check
      const hasIrq = ctx.interrupts.some(i => i.id === uart.irqId || i.irqNumber !== undefined);
      if (!hasIrq) {
        issues.push(this.createIssue({
          id: `ISSUE-${uart.id}-NO-IRQ`,
          severity: 'ERROR',
          category: 'interrupt',
          affectedComponent: uart.id,
          rootCause: `UART peripheral '${uart.name || uart.id}' has no assigned GIC/NVIC interrupt line.`,
          engineeringExplanation: 'Non-polled interrupt-driven UART driver execution requires an assigned IRQ line for RX buffer trigger.',
          suggestedFix: `Connect interrupt routing table entry to '${uart.id}'.`,
          confidence: 90
        }));
      }
    }

    return issues;
  }
}

export class MemoryOverlapValidationRule extends BaseEVERule {
  public readonly id = 'rule-memory-overlap';
  public readonly name = 'Memory Address Space Overlap Rule';
  public readonly category = 'memory';

  public evaluate(ctx: ValidationContext): ValidationIssueItem[] {
    const issues: ValidationIssueItem[] = [];
    const sorted = [...ctx.peripherals]
      .map(p => ({ ...p, addrNum: parseInt(p.baseAddress || p.baseAddressHex || '', 16) }))
      .filter(p => !isNaN(p.addrNum))
      .sort((a, b) => a.addrNum - b.addrNum);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (next.addrNum < current.addrNum + (current.sizeBytes || 0x1000)) {
        issues.push(this.createIssue({
          id: `ISSUE-OVERLAP-${current.id}-${next.id}`,
          severity: 'CRITICAL',
          category: 'resource',
          affectedComponent: `${current.id} / ${next.id}`,
          rootCause: `Register address memory overlap between '${current.id}' and '${next.id}'.`,
          engineeringExplanation: `Memory region starting at ${current.baseAddress || current.baseAddressHex} collides with ${next.baseAddress || next.baseAddressHex}.`,
          suggestedFix: `Reassign base address of '${next.id}' to a non-overlapping 64KB boundary offset.`,
          confidence: 100,
          relatedDependencies: [current.id, next.id]
        }));
      }
    }

    return issues;
  }
}

export class EthernetValidationRule extends BaseEVERule {
  public readonly id = 'rule-ethernet-requirements';
  public readonly name = 'Ethernet Controller Requirements Rule';
  public readonly category = 'peripheral';

  public evaluate(ctx: ValidationContext): ValidationIssueItem[] {
    const issues: ValidationIssueItem[] = [];
    const eths = ctx.peripherals.filter(p => (p.category || '').toUpperCase() === 'ETH' || p.name?.toLowerCase().includes('eth') || p.name?.toLowerCase().includes('mac'));

    for (const eth of eths) {
      const hasDma = ctx.peripherals.some(p => p.category === 'DMA' || p.type === 'DMA') || eth.hasDma !== false;
      if (!hasDma) {
        issues.push(this.createIssue({
          id: `ISSUE-${eth.id}-NO-DMA`,
          severity: 'ERROR',
          category: 'dma',
          affectedComponent: eth.id,
          rootCause: `Ethernet MAC controller '${eth.id}' lacks DMA packet descriptor engine.`,
          engineeringExplanation: 'Gigabit Ethernet throughput requires DMA ring buffers for zero-copy socket buffer transmission.',
          suggestedFix: `Enable Scatter-Gather DMA channel assignment for '${eth.id}'.`,
          confidence: 95
        }));
      }
    }

    return issues;
  }
}

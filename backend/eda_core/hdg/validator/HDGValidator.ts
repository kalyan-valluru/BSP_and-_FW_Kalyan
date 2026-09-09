import { DirectedGraph } from '../graph/DirectedGraph';
import { HDGValidationIssue } from '../types/hdgTypes';
import { CycleDetector } from '../algorithms/CycleDetector';

export class HDGValidator {
  private cycleDetector = new CycleDetector();

  public validateGraph(graph: DirectedGraph): HDGValidationIssue[] {
    const issues: HDGValidationIssue[] = [];
    const nodes = graph.listNodes();

    // 1. Cycle Detection
    const cycleRes = this.cycleDetector.detectCycles(graph);
    if (cycleRes.hasCycle) {
      issues.push({
        nodeId: cycleRes.cyclePath ? cycleRes.cyclePath[0] : 'graph',
        severity: 'error',
        message: `Circular dependency detected in graph: ${cycleRes.cyclePath?.join(' -> ')}`
      });
    }

    // 2. Structural Checks for Peripherals
    for (const node of nodes) {
      if (node.type === 'peripheral') {
        const incoming = graph.getIncomingEdges(node.id);
        const hasClock = incoming.some(e => e.type === 'REQUIRES_CLOCK');
        const hasMemory = incoming.some(e => e.type === 'REQUIRES_MEMORY');

        if (!hasClock) {
          issues.push({
            nodeId: node.id,
            severity: 'warning',
            message: `Peripheral '${node.id}' has no explicit clock source dependency edge.`
          });
        }
        if (!hasMemory) {
          issues.push({
            nodeId: node.id,
            severity: 'warning',
            message: `Peripheral '${node.id}' has no explicit memory region assignment edge.`
          });
        }
      }

      // Orphan check
      const incoming = graph.getIncomingEdges(node.id);
      const outgoing = graph.getOutgoingEdges(node.id);
      if (incoming.length === 0 && outgoing.length === 0 && node.type !== 'board') {
        issues.push({
          nodeId: node.id,
          severity: 'warning',
          message: `Orphan disconnected graph entity detected: '${node.id}' (${node.type})`
        });
      }
    }

    return issues;
  }
}

import { DirectedGraph } from '../graph/DirectedGraph';
import { HDGNode } from '../types/hdgTypes';

export class TopologicalSort {
  /**
   * Returns deterministic hardware initialization ordering using Kahn's Algorithm
   */
  public sort(graph: DirectedGraph): { order: HDGNode[]; hasCycle: boolean } {
    const nodes = graph.listNodes();
    const inDegree = new Map<string, number>();

    // 1. Calculate initial in-degrees (number of incoming dependency edges)
    for (const node of nodes) {
      const incoming = graph.getIncomingEdges(node.id);
      inDegree.set(node.id, incoming.length);
    }

    // 2. Enqueue all zero in-degree nodes (root clocks, power domains, vendors)
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const resultIds: string[] = [];

    // 3. Process queue
    while (queue.length > 0) {
      // Sort alphabetically for deterministic ordering
      queue.sort();
      const currId = queue.shift()!;
      resultIds.push(currId);

      const outgoing = graph.getOutgoingEdges(currId);
      for (const edge of outgoing) {
        const targetId = edge.targetId;
        const currentDeg = inDegree.get(targetId)! - 1;
        inDegree.set(targetId, currentDeg);

        if (currentDeg === 0) {
          queue.push(targetId);
        }
      }
    }

    const hasCycle = resultIds.length !== nodes.length;
    const order = resultIds.map(id => graph.getNode(id)!).filter(Boolean);

    return { order, hasCycle };
  }
}

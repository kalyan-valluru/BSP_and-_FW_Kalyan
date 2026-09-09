import { DirectedGraph } from '../graph/DirectedGraph';

export class CycleDetector {
  /**
   * Detects cycles in the directed hardware graph using Depth-First Search
   */
  public detectCycles(graph: DirectedGraph): { hasCycle: boolean; cyclePath?: string[] } {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const outgoing = graph.getOutgoingEdges(nodeId);
      for (const edge of outgoing) {
        const neighbor = edge.targetId;

        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const node of graph.listNodes()) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          return { hasCycle: true, cyclePath: [...path] };
        }
      }
    }

    return { hasCycle: false };
  }
}

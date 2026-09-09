import { DirectedGraph } from '../graph/DirectedGraph';
import { HDGNode, ImpactAnalysisResult } from '../types/hdgTypes';

export class ImpactAnalyzer {
  /**
   * Calculates all downstream nodes affected if a source node is modified or reconfigured
   */
  public analyzeImpact(graph: DirectedGraph, sourceEntityId: string): ImpactAnalysisResult {
    const sourceNode = graph.getNode(sourceEntityId);
    if (!sourceNode) {
      return { sourceEntityId, directlyAffectedCount: 0, totalAffectedCount: 0, affectedNodes: [] };
    }

    const visited = new Set<string>();
    const queue: string[] = [sourceEntityId];
    const affectedNodes: HDGNode[] = [];

    // Direct children
    const directOutgoing = graph.getOutgoingEdges(sourceEntityId);
    const directlyAffectedCount = directOutgoing.length;

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (!visited.has(currentId)) {
        visited.add(currentId);

        if (currentId !== sourceEntityId) {
          const node = graph.getNode(currentId);
          if (node) affectedNodes.push(node);
        }

        const outgoing = graph.getOutgoingEdges(currentId);
        for (const edge of outgoing) {
          if (!visited.has(edge.targetId)) {
            queue.push(edge.targetId);
          }
        }
      }
    }

    return {
      sourceEntityId,
      directlyAffectedCount,
      totalAffectedCount: affectedNodes.length,
      affectedNodes
    };
  }
}

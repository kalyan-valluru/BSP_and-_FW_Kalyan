export interface GraphNode {
  id: string;
  type: 'board' | 'processor' | 'peripheral' | 'driver' | 'doc' | 'issue';
  label: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export class EngineeringKnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];

  constructor() {
    this.initializeDefaultGraph();
  }

  private initializeDefaultGraph() {
    // Register Default Nodes
    this.addNode({ id: 'zcu104', type: 'board', label: 'ZCU104 Evaluation Kit' });
    this.addNode({ id: 'cortex_a53', type: 'processor', label: 'ARM Cortex-A53' });
    this.addNode({ id: 'uartps', type: 'driver', label: 'xuartps Driver' });
    this.addNode({ id: 'ug1085', type: 'doc', label: 'UG1085: Technical Reference Manual' });
    this.addNode({ id: 'tx_fifo_overflow', type: 'issue', label: 'TX FIFO Overflow on High Baud Rates' });

    // Link Nodes
    this.addEdge('zcu104', 'cortex_a53', 'houses');
    this.addEdge('cortex_a53', 'uartps', 'uses_driver');
    this.addEdge('uartps', 'ug1085', 'documented_in');
    this.addEdge('uartps', 'tx_fifo_overflow', 'has_known_issue');
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(source: string, target: string, relation: string): void {
    this.edges.push({ source, target, relation });
  }

  queryNeighbors(nodeId: string): { node: GraphNode; relation: string }[] {
    const results: { node: GraphNode; relation: string }[] = [];
    for (const edge of this.edges) {
      if (edge.source === nodeId) {
        const targetNode = this.nodes.get(edge.target);
        if (targetNode) results.push({ node: targetNode, relation: edge.relation });
      } else if (edge.target === nodeId) {
        const sourceNode = this.nodes.get(edge.source);
        if (sourceNode) results.push({ node: sourceNode, relation: edge.relation });
      }
    }
    return results;
  }
}

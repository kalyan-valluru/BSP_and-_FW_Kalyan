import { DirectedGraph } from '../graph/DirectedGraph';
import { HDGNode } from '../types/hdgTypes';
import { TopologicalSort } from '../algorithms/TopologicalSort';

export class HDGQueryEngine {
  private topoSort = new TopologicalSort();

  public findDependencies(graph: DirectedGraph, entityId: string): HDGNode[] {
    const incoming = graph.getIncomingEdges(entityId);
    return incoming.map(e => graph.getNode(e.sourceId)!).filter(Boolean);
  }

  public findDependents(graph: DirectedGraph, entityId: string): HDGNode[] {
    const outgoing = graph.getOutgoingEdges(entityId);
    return outgoing.map(e => graph.getNode(e.targetId)!).filter(Boolean);
  }

  public findInitializationOrder(graph: DirectedGraph): HDGNode[] {
    const res = this.topoSort.sort(graph);
    return res.order;
  }

  public findRequiredDrivers(graph: DirectedGraph, processorId: string): HDGNode[] {
    const nodes = graph.listNodes();
    return nodes.filter(n => n.type === 'driver');
  }

  public findClockDependencies(graph: DirectedGraph, entityId: string): HDGNode[] {
    const incoming = graph.getIncomingEdges(entityId);
    return incoming
      .map(e => graph.getNode(e.sourceId)!)
      .filter(n => n && (n.type === 'clock_controller' || n.type === 'clock_source'));
  }

  public findInterruptDependencies(graph: DirectedGraph, entityId: string): HDGNode[] {
    const incoming = graph.getIncomingEdges(entityId);
    return incoming
      .map(e => graph.getNode(e.sourceId)!)
      .filter(n => n && (n.type === 'interrupt_controller' || n.type === 'interrupt'));
  }

  public findDMARequirements(graph: DirectedGraph, entityId: string): HDGNode[] {
    const incoming = graph.getIncomingEdges(entityId);
    return incoming
      .map(e => graph.getNode(e.sourceId)!)
      .filter(n => n && (n.type === 'dma_controller' || n.type === 'dma_channel'));
  }

  public findMemoryRequirements(graph: DirectedGraph, entityId: string): HDGNode[] {
    const incoming = graph.getIncomingEdges(entityId);
    return incoming
      .map(e => graph.getNode(e.sourceId)!)
      .filter(n => n && n.type === 'memory_region');
  }
}

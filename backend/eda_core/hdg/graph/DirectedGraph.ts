import { HDGNode, HDGEdge } from '../types/hdgTypes';

export class DirectedGraph {
  private nodes = new Map<string, Readonly<HDGNode>>();
  private outgoingEdges = new Map<string, Map<string, HDGEdge>>(); // source -> target -> edge
  private incomingEdges = new Map<string, Map<string, HDGEdge>>(); // target -> source -> edge

  public addNode(node: HDGNode): void {
    if (!node || !node.id) return;
    const frozen = Object.freeze({ ...node });
    this.nodes.set(node.id, frozen);

    if (!this.outgoingEdges.has(node.id)) {
      this.outgoingEdges.set(node.id, new Map());
    }
    if (!this.incomingEdges.has(node.id)) {
      this.incomingEdges.set(node.id, new Map());
    }
  }

  public addEdge(edge: HDGEdge): boolean {
    if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
      console.warn(`[HDG Warning] Refused edge creation from '${edge.sourceId}' to '${edge.targetId}': Node missing.`);
      return false;
    }

    const frozen = Object.freeze({ ...edge });
    this.outgoingEdges.get(edge.sourceId)!.set(edge.targetId, frozen);
    this.incomingEdges.get(edge.targetId)!.set(edge.sourceId, frozen);
    return true;
  }

  public getNode(id: string): Readonly<HDGNode> | undefined {
    return this.nodes.get(id);
  }

  public hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  public listNodes(): Readonly<HDGNode>[] {
    return Array.from(this.nodes.values());
  }

  public getOutgoingEdges(sourceId: string): HDGEdge[] {
    const map = this.outgoingEdges.get(sourceId);
    return map ? Array.from(map.values()) : [];
  }

  public getIncomingEdges(targetId: string): HDGEdge[] {
    const map = this.incomingEdges.get(targetId);
    return map ? Array.from(map.values()) : [];
  }

  public clear(): void {
    this.nodes.clear();
    this.outgoingEdges.clear();
    this.incomingEdges.clear();
  }

  public countNodes(): number {
    return this.nodes.size;
  }
}

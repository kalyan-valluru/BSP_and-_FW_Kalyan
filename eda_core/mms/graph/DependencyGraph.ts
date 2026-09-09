import { BaseMetadataItem } from '../types/mmsTypes';

export interface GraphNode {
  id: string;
  category: string;
  name: string;
  children: string[];
  parents: string[];
}

export class DependencyGraph {
  private nodes = new Map<string, GraphNode>();

  public buildGraph(items: Iterable<BaseMetadataItem>): void {
    this.nodes.clear();

    // 1. Create nodes
    for (const item of items) {
      this.nodes.set(item.id, {
        id: item.id,
        category: item.category,
        name: item.name,
        children: [],
        parents: []
      });
    }

    // 2. Link relationships (Vendor -> Processor -> Peripheral -> Registers...)
    for (const item of items) {
      const node = this.nodes.get(item.id)!;

      if (item.category === 'processors' && item.vendorId) {
        this.addDependency(item.vendorId, item.id);
      } else if (item.category === 'boards') {
        if (item.vendorId) this.addDependency(item.vendorId, item.id);
        if (item.processorId) this.addDependency(item.processorId, item.id);
      } else if (item.category === 'peripherals' && item.processorId) {
        this.addDependency(item.processorId, item.id);
      } else if (['clocks', 'memory', 'interrupts'].includes(item.category) && item.processorId) {
        this.addDependency(item.processorId, item.id);
      } else if (item.category === 'registers') {
        const periphId = (item.attributes as any)?.peripheralId || item.vendorId;
        if (periphId) this.addDependency(periphId, item.id);
      }
    }
  }

  public getChildren(nodeId: string): GraphNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.children.map(id => this.nodes.get(id)!).filter(Boolean);
  }

  public getParents(nodeId: string): GraphNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.parents.map(id => this.nodes.get(id)!).filter(Boolean);
  }

  public getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  private addDependency(parentId: string, childId: string) {
    const parentNode = this.nodes.get(parentId);
    const childNode = this.nodes.get(childId);

    if (parentNode && childNode) {
      if (!parentNode.children.includes(childId)) parentNode.children.push(childId);
      if (!childNode.parents.includes(parentId)) childNode.parents.push(parentId);
    }
  }
}

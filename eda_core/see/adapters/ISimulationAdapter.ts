import { SimulationResult } from '../types/seeTypes';

export interface ISimulationAdapter {
  readonly id: string;
  readonly name: string;

  runSimulation(artifact: any, context: Record<string, any>): Promise<SimulationResult>;
}

export class AdapterRegistry {
  private adapters: Map<string, ISimulationAdapter> = new Map();

  public register(adapter: ISimulationAdapter): void {
    if (!adapter || !adapter.id) return;
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id: string): ISimulationAdapter | undefined {
    return this.adapters.get(id);
  }

  public listAdapters(): ISimulationAdapter[] {
    return Array.from(this.adapters.values());
  }

  public clear(): void {
    this.adapters.clear();
  }
}

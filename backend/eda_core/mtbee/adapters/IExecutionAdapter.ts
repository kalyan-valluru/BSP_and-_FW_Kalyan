import { NormalizedExecutionResult } from '../types/mtbeeTypes';

export interface IExecutionAdapter {
  readonly id: string;
  readonly name: string;

  executeBuild(plan: any, envConfig: Record<string, any>): Promise<NormalizedExecutionResult>;
}

export class AdapterRegistry {
  private adapters: Map<string, IExecutionAdapter> = new Map();

  public register(adapter: IExecutionAdapter): void {
    if (!adapter || !adapter.id) return;
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id: string): IExecutionAdapter | undefined {
    return this.adapters.get(id);
  }

  public listAdapters(): IExecutionAdapter[] {
    return Array.from(this.adapters.values());
  }

  public clear(): void {
    this.adapters.clear();
  }
}

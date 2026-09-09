import { HardwareValidationResult } from '../types/hilveTypes';

export interface IHardwareAdapter {
  readonly id: string;
  readonly name: string;

  executeHardwareValidation(artifact: any, context: Record<string, any>): Promise<HardwareValidationResult>;
}

export class AdapterRegistry {
  private adapters: Map<string, IHardwareAdapter> = new Map();

  public register(adapter: IHardwareAdapter): void {
    if (!adapter || !adapter.id) return;
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id: string): IHardwareAdapter | undefined {
    return this.adapters.get(id);
  }

  public listAdapters(): IHardwareAdapter[] {
    return Array.from(this.adapters.values());
  }

  public clear(): void {
    this.adapters.clear();
  }
}

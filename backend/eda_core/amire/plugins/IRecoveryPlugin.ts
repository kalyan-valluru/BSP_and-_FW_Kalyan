import { RecoveredFact } from '../types/amireTypes';

export interface IRecoveryPlugin {
  readonly id: string;
  readonly name: string;
  recoverMissingFact(propertyName: string, partialPayload: any): Promise<RecoveredFact | undefined>;
}

export class RecoveryRegistry {
  private plugins: Map<string, IRecoveryPlugin> = new Map();

  public register(plugin: IRecoveryPlugin): void {
    if (!plugin || !plugin.id) return;
    this.plugins.set(plugin.id, plugin);
  }

  public listPlugins(): IRecoveryPlugin[] {
    return Array.from(this.plugins.values());
  }

  public clear(): void {
    this.plugins.clear();
  }
}

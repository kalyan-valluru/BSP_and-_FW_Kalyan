import { IPlugin, PluginMetadata } from '../interfaces/IPlugin';
import type { RegistryManager } from '../RegistryManager';

export abstract class BasePlugin implements IPlugin {
  public abstract readonly metadata: PluginMetadata;

  public async onInit(manager: RegistryManager): Promise<void> {
    console.log(`[Plugin Engine] Initialized plugin: ${this.metadata.name} (v${this.metadata.version})`);
  }

  public async onUnload(manager: RegistryManager): Promise<void> {
    console.log(`[Plugin Engine] Unloaded plugin: ${this.metadata.name}`);
  }
}

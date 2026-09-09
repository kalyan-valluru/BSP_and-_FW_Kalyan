import type { RegistryManager } from '../RegistryManager';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  vendorId: string;
  description?: string;
  supportedArchitectures: string[];
  dependencies?: string[];
}

export interface IPlugin {
  readonly metadata: PluginMetadata;
  onInit(manager: RegistryManager): Promise<void>;
  onUnload(manager: RegistryManager): Promise<void>;
}

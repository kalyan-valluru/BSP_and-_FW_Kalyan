import { VENDOR_PLUGINS, VendorPlugin } from './vendorPlugins';

export class PluginManager {
  private static plugins: Map<string, VendorPlugin> = new Map();

  static initialize(): void {
    for (const plugin of VENDOR_PLUGINS) {
      this.plugins.set(plugin.id, plugin);
    }
  }

  static getPlugin(id: string): VendorPlugin | undefined {
    if (this.plugins.size === 0) {
      this.initialize();
    }
    return this.plugins.get(id);
  }

  static registerPlugin(plugin: VendorPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  static getPluginForBoard(processorName: string): VendorPlugin | undefined {
    if (this.plugins.size === 0) {
      this.initialize();
    }
    const name = processorName.toLowerCase();
    for (const plugin of this.plugins.values()) {
      if (plugin.supportedProcessors.some(proc => name.includes(proc))) {
        return plugin;
      }
    }
    return undefined;
  }
}

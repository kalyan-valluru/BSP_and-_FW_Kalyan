import path from 'path';
import {
  ProcessorRegistry,
  PeripheralRegistry,
  BoardRegistry,
  VendorRegistry,
  ToolchainRegistry,
  RuleRegistry
} from './registry';
import { IPlugin } from './interfaces/IPlugin';
import { MetadataLoader } from './loader/MetadataLoader';
import {
  AMDPlugin,
  STM32Plugin,
  NXPPlugin,
  TIPlugin,
  QualcommPlugin,
  RenesasPlugin,
  IntelPlugin,
  RaspberryPiPlugin,
  GenericARMPlugin,
  GenericRISCVPlugin
} from './plugins/vendorPlugins';
import {
  ProcessorEntity,
  PeripheralEntity,
  BoardEntity,
  VendorEntity,
  ToolchainEntity,
  RuleEntity
} from './types';

export class RegistryManager {
  private static instance: RegistryManager;

  public readonly processors = new ProcessorRegistry();
  public readonly peripherals = new PeripheralRegistry();
  public readonly boards = new BoardRegistry();
  public readonly vendors = new VendorRegistry();
  public readonly toolchains = new ToolchainRegistry();
  public readonly rules = new RuleRegistry();

  private loader = new MetadataLoader();
  private loadedPlugins: Map<string, IPlugin> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): RegistryManager {
    if (!RegistryManager.instance) {
      RegistryManager.instance = new RegistryManager();
    }
    return RegistryManager.instance;
  }

  /**
   * Safe non-crashing initialization of registries, metadata, and default vendor plugins
   */
  public async initialize(metadataDir?: string): Promise<void> {
    if (this.isInitialized) return;
    console.log('[RegistryManager] Initializing Universal EDA Registries...');

    // 1. Auto-discover and register built-in vendor plugins
    const defaultPlugins: IPlugin[] = [
      new AMDPlugin(),
      new STM32Plugin(),
      new NXPPlugin(),
      new TIPlugin(),
      new QualcommPlugin(),
      new RenesasPlugin(),
      new IntelPlugin(),
      new RaspberryPiPlugin(),
      new GenericARMPlugin(),
      new GenericRISCVPlugin()
    ];

    for (const plugin of defaultPlugins) {
      await this.registerPlugin(plugin);
    }

    // 2. Load structured metadata assets if dir provided or fallback to default
    const targetMetaDir = metadataDir || path.join(process.cwd(), 'eda_core', 'metadata');
    await this.loadMetadataFromDisk(targetMetaDir);

    this.isInitialized = true;
    console.log('[RegistryManager] Universal EDA Registries initialized successfully.');
  }

  /**
   * Safely register a plugin
   */
  public async registerPlugin(plugin: IPlugin): Promise<boolean> {
    if (!plugin || !plugin.metadata || !plugin.metadata.id) {
      console.warn('[RegistryManager] Refused invalid plugin registration.');
      return false;
    }
    if (this.loadedPlugins.has(plugin.metadata.id)) {
      console.warn(`[RegistryManager] Plugin '${plugin.metadata.id}' is already registered. Skipping.`);
      return false;
    }

    try {
      await plugin.onInit(this);
      this.loadedPlugins.set(plugin.metadata.id, plugin);
      return true;
    } catch (err: any) {
      console.error(`[RegistryManager Error] Failed to initialize plugin '${plugin.metadata.id}': ${err.message}`);
      return false;
    }
  }

  /**
   * Safely unregister a plugin
   */
  public async unregisterPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return false;

    try {
      await plugin.onUnload(this);
      this.loadedPlugins.delete(pluginId);
      return true;
    } catch (err: any) {
      console.error(`[RegistryManager Error] Failed to unload plugin '${pluginId}': ${err.message}`);
      return false;
    }
  }

  /**
   * Loads structured JSON metadata into respective registries without crashing on malformed files
   */
  public async loadMetadataFromDisk(baseDir: string): Promise<void> {
    const procItems = await this.loader.loadDirectory<ProcessorEntity>(path.join(baseDir, 'processors'));
    procItems.forEach(item => this.processors.register(item));

    const periItems = await this.loader.loadDirectory<PeripheralEntity>(path.join(baseDir, 'peripherals'));
    periItems.forEach(item => this.peripherals.register(item));

    const boardItems = await this.loader.loadDirectory<BoardEntity>(path.join(baseDir, 'boards'));
    boardItems.forEach(item => this.boards.register(item));

    const vendorItems = await this.loader.loadDirectory<VendorEntity>(path.join(baseDir, 'vendors'));
    vendorItems.forEach(item => this.vendors.register(item));

    const tcItems = await this.loader.loadDirectory<ToolchainEntity>(path.join(baseDir, 'toolchains'));
    tcItems.forEach(item => this.toolchains.register(item));

    const ruleItems = await this.loader.loadDirectory<RuleEntity>(path.join(baseDir, 'rules'));
    ruleItems.forEach(item => this.rules.register(item));
  }

  public listPlugins(): IPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  public resetState(): void {
    this.processors.clear();
    this.peripherals.clear();
    this.boards.clear();
    this.vendors.clear();
    this.toolchains.clear();
    this.rules.clear();
    this.loadedPlugins.clear();
    this.isInitialized = false;
  }
}

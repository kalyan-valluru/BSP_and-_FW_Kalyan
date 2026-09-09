export interface IDriverTemplateEngine {
  readonly id: string;
  readonly name: string;
  readonly supportedCategories: string[];

  renderDriver(peripheralCategory: string, context: Record<string, any>): { sourceContent: string; headerContent: string };
}

export class DriverTemplateRegistry {
  private engines: Map<string, IDriverTemplateEngine> = new Map();

  public register(engine: IDriverTemplateEngine): void {
    if (!engine || !engine.id) return;
    this.engines.set(engine.id, engine);
  }

  public getEngine(id: string): IDriverTemplateEngine | undefined {
    return this.engines.get(id);
  }

  public listEngines(): IDriverTemplateEngine[] {
    return Array.from(this.engines.values());
  }

  public clear(): void {
    this.engines.clear();
  }
}

export interface ILinkerTemplateEngine {
  readonly id: string;
  readonly name: string;
  readonly supportedArchitectures: string[];

  renderLinkerScript(context: Record<string, any>): string;
  renderStartupAssembly(context: Record<string, any>): string;
  renderVectorTable(context: Record<string, any>): { sourceContent: string; headerContent: string };
}

export class LinkerTemplateRegistry {
  private engines: Map<string, ILinkerTemplateEngine> = new Map();

  public register(engine: ILinkerTemplateEngine): void {
    if (!engine || !engine.id) return;
    this.engines.set(engine.id, engine);
  }

  public getEngine(id: string): ILinkerTemplateEngine | undefined {
    return this.engines.get(id);
  }

  public listEngines(): ILinkerTemplateEngine[] {
    return Array.from(this.engines.values());
  }

  public clear(): void {
    this.engines.clear();
  }
}

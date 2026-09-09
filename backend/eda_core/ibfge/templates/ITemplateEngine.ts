export interface ITemplateEngine {
  readonly id: string;
  readonly name: string;
  readonly supportedOS: string[];

  render(templateName: string, context: Record<string, any>): string;
}

export class TemplateRegistry {
  private engines: Map<string, ITemplateEngine> = new Map();

  public register(engine: ITemplateEngine): void {
    if (!engine || !engine.id) return;
    this.engines.set(engine.id, engine);
  }

  public getEngine(id: string): ITemplateEngine | undefined {
    return this.engines.get(id);
  }

  public listEngines(): ITemplateEngine[] {
    return Array.from(this.engines.values());
  }

  public clear(): void {
    this.engines.clear();
  }
}

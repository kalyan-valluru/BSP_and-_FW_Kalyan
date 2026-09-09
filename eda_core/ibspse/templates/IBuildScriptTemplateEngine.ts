export interface IBuildScriptTemplateEngine {
  readonly id: string;
  readonly name: string;

  renderBuildScript(scriptType: 'cmake' | 'makefile' | 'toolchain' | 'compile_commands', context: Record<string, any>): string;
}

export class BuildScriptTemplateRegistry {
  private engines: Map<string, IBuildScriptTemplateEngine> = new Map();

  public register(engine: IBuildScriptTemplateEngine): void {
    if (!engine || !engine.id) return;
    this.engines.set(engine.id, engine);
  }

  public getEngine(id: string): IBuildScriptTemplateEngine | undefined {
    return this.engines.get(id);
  }

  public listEngines(): IBuildScriptTemplateEngine[] {
    return Array.from(this.engines.values());
  }

  public clear(): void {
    this.engines.clear();
  }
}

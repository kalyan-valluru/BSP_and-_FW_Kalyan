import { DocumentClassificationType, ExtractedHardwareFact } from '../types/ahupTypes';

export interface IParserPlugin {
  readonly id: string;
  readonly name: string;
  readonly supportedTypes: DocumentClassificationType[];

  canParse(filename: string, content: string | Buffer): boolean;
  parse(filename: string, content: string | Buffer): Promise<ExtractedHardwareFact[]>;
}

export class ParserRegistry {
  private parsers: Map<string, IParserPlugin> = new Map();

  public register(parser: IParserPlugin): void {
    if (!parser || !parser.id) return;
    this.parsers.set(parser.id, parser);
  }

  public findParser(filename: string, content: string | Buffer): IParserPlugin | undefined {
    for (const p of this.parsers.values()) {
      if (p.canParse(filename, content)) {
        return p;
      }
    }
    return undefined;
  }

  public listParsers(): IParserPlugin[] {
    return Array.from(this.parsers.values());
  }

  public clear(): void {
    this.parsers.clear();
  }
}

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ArtifactNode {
  path: string;
  hash: string;
  dependencies: string[];
}

export class ArtifactDependencyGraph {
  private graph: Record<string, ArtifactNode> = {};

  async calculateHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath);
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = (hash << 5) - hash + content.readUInt8(i);
        hash |= 0;
      }
      return hash.toString(16);
    } catch {
      return '';
    }
  }

  async registerArtifact(filePath: string, dependencies: string[]): Promise<void> {
    const hash = await this.calculateHash(filePath);
    this.graph[filePath] = { path: filePath, hash, dependencies };
  }

  async requiresRegeneration(filePath: string): Promise<boolean> {
    const node = this.graph[filePath];
    if (!node) return true;

    // Check if the file hash has changed
    const currentHash = await this.calculateHash(filePath);
    if (currentHash !== node.hash) return true;

    // Check if any of the dependencies require regeneration
    for (const dep of node.dependencies) {
      const depRequires = await this.requiresRegeneration(dep);
      if (depRequires) return true;
    }

    return false;
  }
}

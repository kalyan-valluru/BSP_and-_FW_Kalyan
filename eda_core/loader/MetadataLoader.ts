import fs from 'fs/promises';
import path from 'path';
import { safeExecute } from '../common/RegistryError';

export class MetadataLoader {
  /**
   * Safely reads a JSON file from disk without throwing/crashing
   */
  public async loadJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (err: any) {
      console.warn(`[MetadataLoader Warning] Failed to read JSON at '${filePath}': ${err.message}`);
      return null;
    }
  }

  /**
   * Loads all JSON metadata files within a directory
   */
  public async loadDirectory<T>(dirPath: string): Promise<T[]> {
    const results: T[] = [];
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.json')) {
          const item = await this.loadJsonFile<T>(path.join(dirPath, file));
          if (item) {
            if (Array.isArray(item)) {
              results.push(...item);
            } else {
              results.push(item);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[MetadataLoader Warning] Could not list directory '${dirPath}': ${err.message}`);
    }
    return results;
  }
}

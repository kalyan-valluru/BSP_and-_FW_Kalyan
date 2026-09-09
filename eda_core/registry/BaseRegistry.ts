import { BaseEntity } from '../types';
import { IRegistry, ValidationResult } from '../interfaces/IRegistry';
import { RegistryError } from '../common/RegistryError';

export abstract class BaseRegistry<T extends BaseEntity, M = Record<string, any>> implements IRegistry<T, M> {
  public abstract readonly name: string;
  protected items: Map<string, T> = new Map();
  protected metadataStore: Map<string, M> = new Map();

  public register(item: T): boolean {
    if (!item || typeof item !== 'object') {
      console.warn(`[${this.name}] Attempted to register invalid or null item.`);
      return false;
    }
    if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
      console.warn(`[${this.name}] Item missing valid string ID.`);
      return false;
    }
    if (this.items.has(item.id)) {
      console.warn(`[${this.name}] Duplicate registration suppressed for ID '${item.id}'. Overwriting safely.`);
    }

    const validation = this.validate(item);
    if (!validation.valid) {
      console.warn(`[${this.name}] Item '${item.id}' failed validation: ${validation.errors.join('; ')}`);
      return false;
    }

    this.items.set(item.id, Object.freeze({ ...item }));
    if (item.metadata) {
      this.metadataStore.set(item.id, Object.freeze({ ...item.metadata } as M));
    }
    return true;
  }

  public unregister(id: string): boolean {
    if (!id || !this.items.has(id)) return false;
    this.items.delete(id);
    this.metadataStore.delete(id);
    return true;
  }

  public get(id: string): T | undefined {
    return this.items.get(id);
  }

  public exists(id: string): boolean {
    return this.items.has(id);
  }

  public list(): T[] {
    return Array.from(this.items.values());
  }

  public search(query: Partial<T> | ((item: T) => boolean)): T[] {
    if (typeof query === 'function') {
      return this.list().filter(query);
    }
    return this.list().filter(item => {
      for (const [key, val] of Object.entries(query)) {
        if ((item as any)[key] !== val) return false;
      }
      return true;
    });
  }

  public validate(item: T): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!item.name || typeof item.name !== 'string') {
      errors.push("Missing required field 'name'.");
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  public metadata(id: string): M | undefined {
    return this.metadataStore.get(id);
  }

  public clear(): void {
    this.items.clear();
    this.metadataStore.clear();
  }

  public count(): number {
    return this.items.size;
  }
}

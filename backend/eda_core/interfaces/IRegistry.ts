import { BaseEntity } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IRegistry<T extends BaseEntity, M = Record<string, any>> {
  readonly name: string;
  register(item: T): boolean;
  unregister(id: string): boolean;
  get(id: string): T | undefined;
  exists(id: string): boolean;
  list(): T[];
  search(query: Partial<T> | ((item: T) => boolean)): T[];
  validate(item: T): ValidationResult;
  metadata(id: string): M | undefined;
  clear(): void;
  count(): number;
}

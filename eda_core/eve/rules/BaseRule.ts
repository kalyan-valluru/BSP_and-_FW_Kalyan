import { ValidationContext, ValidationIssueItem } from '../types/eveTypes';

export interface IEVERule {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  evaluate(ctx: ValidationContext): ValidationIssueItem[];
}

export abstract class BaseEVERule implements IEVERule {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly category: string;

  public abstract evaluate(ctx: ValidationContext): ValidationIssueItem[];

  protected createIssue(params: {
    id: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    category: any;
    affectedComponent: string;
    rootCause: string;
    engineeringExplanation: string;
    suggestedFix: string;
    confidence?: number;
    relatedDependencies?: string[];
    referenceDoc?: string;
  }): ValidationIssueItem {
    return {
      id: params.id,
      severity: params.severity,
      category: params.category,
      affectedComponent: params.affectedComponent,
      rootCause: params.rootCause,
      engineeringExplanation: params.engineeringExplanation,
      suggestedFix: params.suggestedFix,
      confidence: params.confidence ?? 100,
      relatedDependencies: params.relatedDependencies ?? [],
      referenceDocumentation: params.referenceDoc ?? 'AMD / ST / TI Official Technical Reference Manual'
    };
  }
}

export class EVERuleRegistry {
  private rules: Map<string, IEVERule> = new Map();

  public register(rule: IEVERule): void {
    if (!rule || !rule.id) return;
    this.rules.set(rule.id, rule);
  }

  public unregister(id: string): void {
    this.rules.delete(id);
  }

  public listRules(): IEVERule[] {
    return Array.from(this.rules.values());
  }

  public clear(): void {
    this.rules.clear();
  }
}

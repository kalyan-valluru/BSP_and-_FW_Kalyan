import { IntegrityIssue } from '../types/ipiaveTypes';

export interface IIntegrityVerifier {
  readonly id: string;
  readonly name: string;

  verify(projectTree: any[], context: Record<string, any>): Promise<IntegrityIssue[]>;
}

export class VerifierRegistry {
  private verifiers: Map<string, IIntegrityVerifier> = new Map();

  public register(verifier: IIntegrityVerifier): void {
    if (!verifier || !verifier.id) return;
    this.verifiers.set(verifier.id, verifier);
  }

  public getVerifier(id: string): IIntegrityVerifier | undefined {
    return this.verifiers.get(id);
  }

  public listVerifiers(): IIntegrityVerifier[] {
    return Array.from(this.verifiers.values());
  }

  public clear(): void {
    this.verifiers.clear();
  }
}

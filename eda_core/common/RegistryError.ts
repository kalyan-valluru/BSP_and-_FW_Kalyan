export class RegistryError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string = 'REGISTRY_ERROR', details?: any) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, RegistryError.prototype);
  }
}

export function safeExecute<T>(fn: () => T, fallback: T, errorHandler?: (err: Error) => void): T {
  try {
    return fn();
  } catch (err: any) {
    if (errorHandler) {
      errorHandler(err instanceof Error ? err : new Error(String(err)));
    } else {
      console.warn(`[Registry Warning] Non-fatal caught error (${err.message}). Using fallback.`);
    }
    return fallback;
  }
}

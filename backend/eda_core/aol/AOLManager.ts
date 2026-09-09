import { AIOrchestrator } from './orchestrator/AIOrchestrator';
import { AIOrchestrationResult, AISessionContext } from './types/aolTypes';

export class AOLManager {
  private static instance: AOLManager;

  public readonly orchestrator = new AIOrchestrator();

  private constructor() {}

  public static getInstance(): AOLManager {
    if (!AOLManager.instance) {
      AOLManager.instance = new AOLManager();
    }
    return AOLManager.instance;
  }

  /**
   * Process user natural-language prompt via AI Orchestrator
   */
  public async processRequest(userPrompt: string, sessionContext: AISessionContext): Promise<AIOrchestrationResult> {
    return this.orchestrator.orchestrate(userPrompt, sessionContext);
  }
}

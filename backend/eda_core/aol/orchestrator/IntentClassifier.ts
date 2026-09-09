import { UserIntent } from '../types/aolTypes';

export class IntentClassifier {
  public classify(userPrompt: string): UserIntent {
    const p = userPrompt.toLowerCase();

    if (p.includes('bsp') || p.includes('generate') || p.includes('build') || p.includes('firmware')) {
      return 'BSP_GENERATION';
    }
    if (p.includes('not working') || p.includes('error') || p.includes('issue') || p.includes('debug') || p.includes('why')) {
      return 'DIAGNOSTIC';
    }
    if (p.includes('relocate') || p.includes('fix') || p.includes('transform') || p.includes('repair')) {
      return 'TRANSFORMATION';
    }
    if (p.includes('processor') || p.includes('memory') || p.includes('clock') || p.includes('specs') || p.includes('query')) {
      return 'HARDWARE_QUERY';
    }

    return 'UNKNOWN';
  }
}

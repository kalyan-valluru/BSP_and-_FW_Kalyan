import { ProviderHealth, RouterHealthStatus, LLMProviderType } from '../router/types';
import { routerConfigManager } from '../router/config';
import { groqProvider } from '../providers/groqProvider';
import { ollamaProvider } from '../providers/ollamaProvider';

export class HealthChecker {
  private healthCache: Map<string, { health: ProviderHealth; timestamp: number }> = new Map();
  private cacheTtlMs = 15000;

  public async checkGroqHealth(forceRefresh = false): Promise<ProviderHealth> {
    const config = routerConfigManager.getConfig();
    const cacheKey = `groq_${config.groqApiKey}_${config.defaultCloudModel}`;

    if (!forceRefresh) {
      const cached = this.healthCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTtlMs) {
        return cached.health;
      }
    }

    const health = await groqProvider.checkHealth();
    this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
    return health;
  }

  public async checkOllamaHealth(forceRefresh = false): Promise<ProviderHealth> {
    const config = routerConfigManager.getConfig();
    const cacheKey = `ollama_${config.ollamaBaseUrl}_${config.defaultLocalModel}`;

    if (!forceRefresh) {
      const cached = this.healthCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTtlMs) {
        return cached.health;
      }
    }

    const health = await ollamaProvider.checkHealth();
    this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
    return health;
  }

  public async getOverallHealth(forceRefresh = false): Promise<RouterHealthStatus> {
    const config = routerConfigManager.getConfig();
    const [cloud, local] = await Promise.all([
      this.checkGroqHealth(forceRefresh),
      this.checkOllamaHealth(forceRefresh),
    ]);

    let activeProvider: LLMProviderType | 'none' = 'none';
    let activeEngine = 'None';
    let statusSummary = '';
    let fallbackActive = false;

    if (config.enableCloud && cloud.healthy) {
      activeProvider = 'groq';
      activeEngine = `Groq Cloud (${config.defaultCloudModel})`;
      statusSummary = '✓ Groq Cloud AI active';
    } else if (config.enableLocal && local.reachable) {
      activeProvider = 'ollama';
      activeEngine = `Qwen2.5 Local (${config.defaultLocalModel})`;
      fallbackActive = config.enableCloud && !cloud.healthy;
      statusSummary = fallbackActive ? 'Cloud unavailable.\nRunning on Local AI.' : '✓ Ollama Local AI active';
    } else {
      statusSummary = '⚠ All AI providers unavailable';
    }

    return {
      cloud,
      local,
      activeEngine,
      activeProvider,
      statusSummary,
      fallbackActive,
    };
  }

  public clearCache(): void {
    this.healthCache.clear();
  }
}

export const healthChecker = new HealthChecker();

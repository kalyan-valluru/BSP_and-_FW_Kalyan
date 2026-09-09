import { ProviderHealth, RouterHealthStatus, LLMProviderType } from '../types';
import { routerConfigManager } from '../config';

export class HealthChecker {
  private healthCache: Map<string, { health: ProviderHealth; timestamp: number }> = new Map();
  private cacheTtlMs = 15000; // 15 seconds cache

  public async checkGeminiHealth(forceRefresh = false): Promise<ProviderHealth> {
    const config = routerConfigManager.getConfig();
    const cacheKey = `gemini_${config.geminiApiKey}_${config.defaultCloudModel}`;
    
    if (!forceRefresh) {
      const cached = this.healthCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTtlMs) {
        return cached.health;
      }
    }

    const now = new Date().toISOString();

    if (!config.geminiApiKey || config.geminiApiKey.trim() === '') {
      const health: ProviderHealth = {
        healthy: false,
        reachable: false,
        authValid: false,
        details: 'Gemini API key missing. Configure GEMINI_API_KEY.',
        lastChecked: now,
      };
      this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
      return health;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Probe Gemini API endpoint
      const url = `${config.geminiBaseUrl}/v1beta/models?key=${config.geminiApiKey}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name?.replace('models/', '') || m.name) : [];
        const health: ProviderHealth = {
          healthy: true,
          reachable: true,
          authValid: true,
          availableModels: models,
          selectedModelAvailable: true,
          details: `Gemini API operational. (${models.length} models accessible)`,
          lastChecked: now,
        };
        this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
        return health;
      }

      if (response.status === 401 || response.status === 403) {
        const health: ProviderHealth = {
          healthy: false,
          reachable: true,
          authValid: false,
          details: `Authentication failed (HTTP ${response.status}). Invalid API key.`,
          lastChecked: now,
        };
        this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
        return health;
      }

      const health: ProviderHealth = {
        healthy: false,
        reachable: true,
        authValid: true,
        details: `Gemini API returned HTTP ${response.status}`,
        lastChecked: now,
      };
      this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
      return health;

    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      const health: ProviderHealth = {
        healthy: false,
        reachable: false,
        authValid: false,
        details: isTimeout ? 'Network timeout reaching Gemini API' : `Network failure: ${err.message}`,
        lastChecked: now,
      };
      this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
      return health;
    }
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

    const now = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const url = `${config.ollamaBaseUrl}/api/tags`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({ models: [] }));
        const availableModels: string[] = (data.models || []).map((m: any) => m.name || m.model);
        
        // Check if default or any priority models are downloaded
        const targetModel = config.defaultLocalModel;
        const isSelectedAvailable = availableModels.some(m => 
          m.toLowerCase().startsWith(targetModel.toLowerCase()) || 
          targetModel.toLowerCase().startsWith(m.toLowerCase())
        );

        const health: ProviderHealth = {
          healthy: true,
          reachable: true,
          availableModels,
          selectedModelAvailable: isSelectedAvailable,
          details: `Ollama service running. Found ${availableModels.length} local model(s). Selected model (${targetModel}): ${isSelectedAvailable ? 'Installed' : 'Not installed'}`,
          lastChecked: now,
        };
        this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
        return health;
      }

      const health: ProviderHealth = {
        healthy: false,
        reachable: true,
        details: `Ollama service returned HTTP ${response.status}`,
        lastChecked: now,
      };
      this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
      return health;

    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      const health: ProviderHealth = {
        healthy: false,
        reachable: false,
        selectedModelAvailable: false,
        details: isTimeout ? 'Ollama connection timed out (Service not running)' : `Ollama unreachable at ${config.ollamaBaseUrl}: ${err.message}`,
        lastChecked: now,
      };
      this.healthCache.set(cacheKey, { health, timestamp: Date.now() });
      return health;
    }
  }

  public async getOverallHealth(forceRefresh = false): Promise<RouterHealthStatus> {
    const config = routerConfigManager.getConfig();
    const [cloud, local] = await Promise.all([
      this.checkGeminiHealth(forceRefresh),
      this.checkOllamaHealth(forceRefresh),
    ]);

    let activeProvider: LLMProviderType | 'none' = 'none';
    let activeEngine = 'None';
    let statusSummary = '';
    let fallbackActive = false;

    if (config.enableCloud && cloud.healthy) {
      activeProvider = 'gemini';
      activeEngine = `Gemini (${config.defaultCloudModel})`;
      statusSummary = '✓ Gemini Cloud AI active';
    } else if (config.enableLocal && local.reachable) {
      activeProvider = 'ollama';
      activeEngine = `Ollama Local (${config.defaultLocalModel})`;
      fallbackActive = config.enableCloud && !cloud.healthy;
      statusSummary = fallbackActive ? 'Cloud unavailable — Running on Local AI (Ollama)' : '✓ Ollama Local AI active';
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

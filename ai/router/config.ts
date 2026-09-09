import dotenv from 'dotenv';
import path from 'path';
import { RouterConfig, PreferredProviderType } from './types';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });
dotenv.config();

function getDefaultConfig(): RouterConfig {
  const localPriorityStr = process.env.OLLAMA_MODEL_PRIORITY || 'qwen2.5-coder,llama3,mistral';
  const localModelPriority = localPriorityStr.split(',').map(s => s.trim()).filter(Boolean);

  return {
    defaultCloudModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',

    defaultLocalModel: process.env.OLLAMA_MODEL || localModelPriority[0] || 'qwen2.5-coder',
    localModelPriority: localModelPriority.length > 0 ? localModelPriority : ['qwen2.5-coder', 'llama3', 'mistral'],
    enableCloud: process.env.ENABLE_CLOUD_AI !== 'false',
    enableLocal: process.env.ENABLE_LOCAL_AI !== 'false',
    preferredProvider: (process.env.PREFERRED_AI_PROVIDER as PreferredProviderType) || 'openai',
    autoFallback: process.env.AUTO_FALLBACK !== 'false',
    retryCount: process.env.AI_RETRY_COUNT ? parseInt(process.env.AI_RETRY_COUNT, 10) : 2,
    timeoutMs: process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 30000,
    groqApiKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.AI_API_KEY || '',
    groqBaseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY || '',
    geminiBaseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-6-astra',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  };
}

class ConfigManager {
  private config: RouterConfig;

  constructor() {
    this.config = getDefaultConfig();
  }

  public getConfig(): RouterConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<RouterConfig>): RouterConfig {
    this.config = {
      ...this.config,
      ...updates,
      localModelPriority: updates.localModelPriority || this.config.localModelPriority,
    };
    return this.getConfig();
  }

  public resetConfig(): RouterConfig {
    this.config = getDefaultConfig();
    return this.getConfig();
  }
}

export const routerConfigManager = new ConfigManager();

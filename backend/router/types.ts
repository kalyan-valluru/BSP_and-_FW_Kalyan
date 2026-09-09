export type LLMProviderType = 'groq' | 'ollama' | 'gemini';
export type PreferredProviderType = 'groq' | 'ollama' | 'gemini' | 'auto';

export type TaskCategory =
  | 'simple_formatting'
  | 'json_cleanup'
  | 'code_generation'
  | 'complex_hardware'
  | 'circuit_understanding'
  | 'large_pdf_reasoning'
  | 'general';

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  taskCategory?: TaskCategory;
  temperature?: number;
  maxTokens?: number;
  imageBase64?: string;
  timeoutMs?: number;
  modelOverride?: string;
  hardwareContext?: any;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMResponse {
  success: boolean;
  provider: LLMProviderType;
  model: string;
  latencyMs: number;
  latency: string;
  confidence?: number | string;
  output: string;
  tokenUsage?: TokenUsage;
  fallbackOccurred?: boolean;
  fallbackReason?: string;
  error?: string;
  diagnostics?: {
    groqError?: string;
    ollamaError?: string;
    geminiError?: string;
    attempts?: Array<{ provider: LLMProviderType; model: string; error: string; timestamp: string }>;
  };
}

export interface RouterConfig {
  defaultCloudModel: string;
  defaultLocalModel: string;
  localModelPriority: string[];
  enableCloud: boolean;
  enableLocal: boolean;
  preferredProvider: PreferredProviderType;
  autoFallback: boolean;
  retryCount: number;
  timeoutMs: number;
  groqApiKey?: string;
  groqBaseUrl?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
  ollamaBaseUrl?: string;
}

export interface ProviderHealth {
  healthy: boolean;
  reachable: boolean;
  authValid?: boolean;
  availableModels?: string[];
  selectedModelAvailable?: boolean;
  details?: string;
  lastChecked: string;
}

export interface RouterHealthStatus {
  cloud: ProviderHealth;
  local: ProviderHealth;
  activeEngine: string;
  activeProvider: LLMProviderType | 'none';
  statusSummary: string;
  fallbackActive: boolean;
}

export interface ILLMProvider {
  readonly name: LLMProviderType;
  checkHealth(): Promise<ProviderHealth>;
  generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse>;
}

import { ILLMProvider, LLMRequest, LLMResponse, ProviderHealth, LLMProviderType } from '../router/types';
import { routerConfigManager } from '../router/config';

export class OllamaProvider implements ILLMProvider {
  public readonly name: LLMProviderType = 'ollama';

  public async checkHealth(): Promise<ProviderHealth> {
    const config = routerConfigManager.getConfig();
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
        
        const targetModel = config.defaultLocalModel;
        const isSelectedAvailable = availableModels.some(m => 
          m.toLowerCase().startsWith(targetModel.toLowerCase()) || 
          targetModel.toLowerCase().startsWith(m.toLowerCase())
        );

        return {
          healthy: true,
          reachable: true,
          availableModels,
          selectedModelAvailable: isSelectedAvailable,
          details: `Ollama service running. (${availableModels.length} models installed). Selected (${targetModel}): ${isSelectedAvailable ? 'Installed' : 'Not installed'}`,
          lastChecked: now,
        };
      }

      return {
        healthy: false,
        reachable: true,
        details: `Ollama service returned HTTP ${response.status}`,
        lastChecked: now,
      };

    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      return {
        healthy: false,
        reachable: false,
        selectedModelAvailable: false,
        details: isTimeout ? 'Ollama connection timed out (Service not running)' : `Ollama unreachable at ${config.ollamaBaseUrl}: ${err.message}`,
        lastChecked: now,
      };
    }
  }

  private async getBestAvailableModel(requestedModel?: string): Promise<string> {
    const config = routerConfigManager.getConfig();
    const priorityList = [
      requestedModel,
      config.defaultLocalModel,
      ...config.localModelPriority,
      'qwen2.5-coder',
      'llama3',
      'mistral',
    ].filter((m): m is string => Boolean(m) && m.trim().length > 0);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({ models: [] }));
        const installed: string[] = (data.models || []).map((m: any) => (m.name || m.model || '').toLowerCase());
        
        if (installed.length > 0) {
          for (const target of priorityList) {
            const match = installed.find(inst => inst.includes(target.toLowerCase()) || target.toLowerCase().includes(inst));
            if (match) {
              return match;
            }
          }
          return installed[0];
        }
      }
    } catch {
      // Fall through to requested or default model
    }

    return requestedModel || config.defaultLocalModel || 'qwen2.5-coder';
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    const config = routerConfigManager.getConfig();
    const startTime = Date.now();
    const timeout = request.timeoutMs || config.timeoutMs;

    const selectedModel = await this.getBestAvailableModel(modelOverride || request.modelOverride);

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    let userContent = request.prompt;
    if (request.imageBase64) {
      userContent += `\n[Image Data attached]`;
    }
    messages.push({ role: 'user', content: userContent });

    const payload = {
      model: selectedModel,
      messages: messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.2,
        num_predict: request.maxTokens ?? 2048,
      },
    };

    const url = `${config.ollamaBaseUrl}/api/chat`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error response body');
        const errorMessage = `Ollama HTTP ${response.status}: ${response.statusText}`;

        return {
          success: false,
          provider: 'ollama',
          model: selectedModel,
          latencyMs,
          latency: `${latencyMs}ms`,
          output: '',
          error: errorMessage,
          diagnostics: { ollamaError: `${errorMessage}. Details: ${errorText.slice(0, 200)}` },
        };
      }

      const data = await response.json();
      const textOutput = data.message?.content || data.response || '';

      const evalCount = data.eval_count || 0;
      const promptEvalCount = data.prompt_eval_count || 0;
      const tokenUsage = {
        promptTokens: promptEvalCount,
        completionTokens: evalCount,
        totalTokens: promptEvalCount + evalCount,
      };

      return {
        success: true,
        provider: 'ollama',
        model: selectedModel,
        latencyMs,
        latency: `${latencyMs}ms`,
        confidence: 0.90,
        output: textOutput,
        tokenUsage: tokenUsage.totalTokens > 0 ? tokenUsage : undefined,
      };

    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout
        ? `Ollama request timed out after ${timeout}ms`
        : `Ollama connection failed (${config.ollamaBaseUrl}): ${err.message}`;

      return {
        success: false,
        provider: 'ollama',
        model: selectedModel,
        latencyMs,
        latency: `${latencyMs}ms`,
        output: '',
        error: errorMessage,
        diagnostics: { ollamaError: errorMessage },
      };
    }
  }
}

export const ollamaProvider = new OllamaProvider();

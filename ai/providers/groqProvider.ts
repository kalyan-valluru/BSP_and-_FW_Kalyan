import { ILLMProvider, LLMRequest, LLMResponse, ProviderHealth, LLMProviderType } from '../router/types';
import { routerConfigManager } from '../router/config';

export class GroqProvider implements ILLMProvider {
  public readonly name: LLMProviderType = 'groq';

  public async checkHealth(): Promise<ProviderHealth> {
    const config = routerConfigManager.getConfig();
    const now = new Date().toISOString();

    if (!config.groqApiKey || config.groqApiKey.trim() === '') {
      return {
        healthy: false,
        reachable: false,
        authValid: false,
        details: 'Groq API key missing. Configure GROQ_API_KEY.',
        lastChecked: now,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `${config.groqBaseUrl}/models`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.groqApiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({ data: [] }));
        const models = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
        return {
          healthy: true,
          reachable: true,
          authValid: true,
          availableModels: models,
          selectedModelAvailable: true,
          details: `Groq Cloud API operational. (${models.length} models available)`,
          lastChecked: now,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          healthy: false,
          reachable: true,
          authValid: false,
          details: `Groq Auth failed (HTTP ${response.status}). Invalid GROQ_API_KEY.`,
          lastChecked: now,
        };
      }

      return {
        healthy: false,
        reachable: true,
        authValid: true,
        details: `Groq API returned HTTP ${response.status}`,
        lastChecked: now,
      };

    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      return {
        healthy: false,
        reachable: false,
        authValid: false,
        details: isTimeout ? 'Network timeout reaching Groq API' : `Groq connection failure: ${err.message}`,
        lastChecked: now,
      };
    }
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    const config = routerConfigManager.getConfig();
    const startTime = Date.now();

    if (!config.groqApiKey || config.groqApiKey.trim() === '') {
      return {
        success: false,
        provider: 'groq',
        model: modelOverride || config.defaultCloudModel,
        latencyMs: Date.now() - startTime,
        latency: `${Date.now() - startTime}ms`,
        output: '',
        error: 'Missing Groq API Key',
        diagnostics: { groqError: 'API key is not configured in GROQ_API_KEY environment variable.' },
      };
    }

    const model = modelOverride || request.modelOverride || config.defaultCloudModel || 'llama-3.3-70b-versatile';
    const timeout = request.timeoutMs || config.timeoutMs;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    let userPrompt = request.prompt;
    if (request.imageBase64) {
      userPrompt += `\n[Base64 Image attached]`;
    }
    messages.push({ role: 'user', content: userPrompt });

    const payload = {
      model,
      messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 2048,
    };

    const url = `${config.groqBaseUrl}/chat/completions`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error response body');
        let errorReason = `Groq HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 401 || response.status === 403) {
          errorReason = `Auth Failure (HTTP ${response.status}): Invalid or unauthorized Groq API key`;
        } else if (response.status === 429) {
          errorReason = `Quota Exceeded / Rate Limited (HTTP 429)`;
        } else if (response.status >= 500) {
          errorReason = `Groq Server Unavailable (HTTP ${response.status})`;
        }

        return {
          success: false,
          provider: 'groq',
          model,
          latencyMs,
          latency: `${latencyMs}ms`,
          output: '',
          error: errorReason,
          diagnostics: { groqError: `${errorReason}. Details: ${errorText.slice(0, 200)}` },
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const textOutput = choice?.message?.content || '';

      const usage = data.usage || {};
      const tokenUsage = {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      };

      return {
        success: true,
        provider: 'groq',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        confidence: 0.98,
        output: textOutput,
        tokenUsage,
      };

    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout
        ? `Groq request timed out after ${timeout}ms`
        : `Groq connection failure: ${err.message}`;

      return {
        success: false,
        provider: 'groq',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        output: '',
        error: errorMessage,
        diagnostics: { groqError: errorMessage },
      };
    }
  }
}

export const groqProvider = new GroqProvider();

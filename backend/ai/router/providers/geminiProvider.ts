import { ILLMProvider, LLMRequest, LLMResponse, ProviderHealth, LLMProviderType } from '../types';
import { routerConfigManager } from '../config';
import { healthChecker } from '../health/healthChecker';

export class GeminiProvider implements ILLMProvider {
  public readonly name: LLMProviderType = 'gemini';

  public async checkHealth(): Promise<ProviderHealth> {
    return healthChecker.checkGeminiHealth();
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    const config = routerConfigManager.getConfig();
    const startTime = Date.now();

    if (!config.geminiApiKey || config.geminiApiKey.trim() === '') {
      return {
        success: false,
        provider: 'gemini',
        model: modelOverride || config.defaultCloudModel,
        latencyMs: Date.now() - startTime,
        latency: `${Date.now() - startTime}ms`,
        output: '',
        error: 'Missing Gemini API Key',
        diagnostics: { geminiError: 'API key is not configured in GEMINI_API_KEY environment variable.' },
      };
    }

    const rawModel = modelOverride || request.modelOverride || config.defaultCloudModel;
    // Format model name for API URL (e.g., gemini-2.5-pro or gemini-1.5-flash)
    const model = rawModel.startsWith('models/') ? rawModel.replace('models/', '') : rawModel;
    const timeout = request.timeoutMs || config.timeoutMs;

    // Construct Gemini REST Payload
    const contents: any[] = [];
    
    if (request.imageBase64) {
      contents.push({
        role: 'user',
        parts: [
          { text: request.prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: request.imageBase64,
            },
          },
        ],
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: request.prompt }],
      });
    }

    const payload: any = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 2048,
      },
    };

    if (request.systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    const url = `${config.geminiBaseUrl}/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

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
        let errorReason = `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 401 || response.status === 403) {
          errorReason = `Auth Failure (HTTP ${response.status}): Invalid or unauthorized API key`;
        } else if (response.status === 429) {
          errorReason = `Quota Exceeded / Rate Limited (HTTP 429)`;
        } else if (response.status >= 500) {
          errorReason = `Gemini Server Unavailable (HTTP ${response.status})`;
        }

        return {
          success: false,
          provider: 'gemini',
          model,
          latencyMs,
          latency: `${latencyMs}ms`,
          output: '',
          error: errorReason,
          diagnostics: { geminiError: `${errorReason}. Raw response: ${errorText.slice(0, 300)}` },
        };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const textOutput = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';

      const usageMetadata = data.usageMetadata || {};
      const tokenUsage = {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      };

      return {
        success: true,
        provider: 'gemini',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        confidence: 0.95,
        output: textOutput,
        tokenUsage,
      };

    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout
        ? `Request timed out after ${timeout}ms`
        : `Network/connection error: ${err.message}`;

      return {
        success: false,
        provider: 'gemini',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        output: '',
        error: errorMessage,
        diagnostics: { geminiError: errorMessage },
      };
    }
  }
}

export const geminiProvider = new GeminiProvider();

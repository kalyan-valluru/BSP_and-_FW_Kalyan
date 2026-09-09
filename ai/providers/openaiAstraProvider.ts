import { ILLMProvider, LLMRequest, LLMResponse, ProviderHealth, LLMProviderType } from '../router/types';
import { routerConfigManager } from '../router/config';

export class OpenAIAstraProvider implements ILLMProvider {
  public readonly name: LLMProviderType = 'openai';

  public async checkHealth(): Promise<ProviderHealth> {
    const config = routerConfigManager.getConfig();
    const now = new Date().toISOString();
    const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';

    if (!apiKey.trim()) {
      return {
        healthy: false,
        reachable: false,
        authValid: false,
        details: 'OpenAI API key missing. Configure OPENAI_API_KEY.',
        lastChecked: now,
      };
    }

    try {
      const response = await fetch(`${config.openaiBaseUrl || 'https://api.openai.com/v1'}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return {
          healthy: true,
          reachable: true,
          authValid: true,
          selectedModelAvailable: true,
          details: 'OpenAI API reachable; GPT-6 Astra configured as primary model.',
          lastChecked: now,
        };
      }
      return {
        healthy: false,
        reachable: true,
        authValid: response.status !== 401 && response.status !== 403,
        details: `OpenAI API returned HTTP ${response.status}.`,
        lastChecked: now,
      };
    } catch (err: any) {
      return {
        healthy: false,
        reachable: false,
        authValid: false,
        details: `OpenAI connection failure: ${err.message}`,
        lastChecked: now,
      };
    }
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    const config = routerConfigManager.getConfig();
    const started = Date.now();
    const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';
    const model = modelOverride || request.modelOverride || config.openaiModel || 'gpt-6-astra';

    if (!apiKey.trim()) {
      return {
        success: false,
        provider: 'openai',
        model,
        latencyMs: Date.now() - started,
        latency: `${Date.now() - started}ms`,
        output: '',
        error: 'Missing OpenAI API Key',
        diagnostics: { openaiError: 'OPENAI_API_KEY is not configured.' },
      };
    }

    try {
      const body: any = {
        model,
        input: request.prompt,
        reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
        max_output_tokens: request.maxTokens || 4096,
      };
      if (request.systemPrompt) body.instructions = request.systemPrompt;

      const response = await fetch(`${config.openaiBaseUrl || 'https://api.openai.com/v1'}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(request.timeoutMs || config.timeoutMs || 60000),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`OpenAI HTTP ${response.status}: ${detail.slice(0, 500)}`);
      }

      const data: any = await response.json();
      const output = data.output_text || (data.output || [])
        .flatMap((item: any) => item?.content || [])
        .filter((c: any) => c?.type === 'output_text')
        .map((c: any) => c.text || '')
        .join('');
      const latencyMs = Date.now() - started;

      return {
        success: true,
        provider: 'openai',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        output,
        confidence: 0.99,
        tokenUsage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: data.usage.total_tokens || ((data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)),
        } : undefined,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - started;
      return {
        success: false,
        provider: 'openai',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        output: '',
        error: `OpenAI Astra request failed: ${err.message}`,
        diagnostics: { openaiError: err.message },
      };
    }
  }
}

export const openaiAstraProvider = new OpenAIAstraProvider();

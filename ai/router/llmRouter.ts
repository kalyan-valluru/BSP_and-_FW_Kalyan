import {
  LLMRequest,
  LLMResponse,
  RouterConfig,
  RouterHealthStatus,
  TaskCategory,
  LLMProviderType,
} from './types';
import { routerConfigManager } from './config';
import { healthChecker } from '../health/healthChecker';
import { groqProvider } from '../providers/groqProvider';
import { geminiProvider } from '../providers/geminiProvider';
import { ollamaProvider } from '../providers/ollamaProvider';
import { openaiAstraProvider } from '../providers/openaiAstraProvider';

export class LLMRouter {
  private detectTaskCategory(request: LLMRequest): TaskCategory {
    if (request.taskCategory) return request.taskCategory;

    const combinedPrompt = `${request.systemPrompt || ''} ${request.prompt}`.toLowerCase();

    if (/complex hardware|fpga|vivado|vitis|xsa|tcl patch|clock distribution|timing violation|address assignment/i.test(combinedPrompt)) {
      return 'complex_hardware';
    }
    if (/circuit|schematic|netlist|pinout|pcb|trace/i.test(combinedPrompt)) {
      return 'circuit_understanding';
    }
    if (/pdf|datasheet|document analysis|spec sheet/i.test(combinedPrompt)) {
      return 'large_pdf_reasoning';
    }
    if (/json cleanup|raw json|format json|parse json/i.test(combinedPrompt)) {
      return 'json_cleanup';
    }
    if (/format text|pretty print|markdown format/i.test(combinedPrompt)) {
      return 'simple_formatting';
    }
    if (/code generation|generate c code|generate verilog|write script/i.test(combinedPrompt)) {
      return 'code_generation';
    }

    return 'general';
  }

  private determinePrimaryProvider(request: LLMRequest, config: RouterConfig): LLMProviderType {
    if (config.preferredProvider === 'openai') return 'openai';
    if (config.preferredProvider === 'gemini') return 'gemini';
    if (config.preferredProvider === 'groq') return 'groq';
    if (config.preferredProvider === 'ollama') return 'ollama';

    // Default: GPT-6 Astra is primary cloud model, then Gemini, then local Ollama.
    return config.enableCloud ? 'openai' : 'ollama';
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const config = routerConfigManager.getConfig();
    const primaryProviderType = this.determinePrimaryProvider(request, config);
    const attempts: Array<{ provider: LLMProviderType; model: string; error: string; timestamp: string }> = [];
    const startTime = Date.now();

    console.log(`[AI Router] Request received | Task: ${request.taskCategory || this.detectTaskCategory(request)} | Primary Provider: ${primaryProviderType.toUpperCase()}`);

    // Provider execution queue keeps Astra primary while preserving existing fallbacks.
    const preferredOrder: LLMProviderType[] = primaryProviderType === 'ollama'
      ? ['ollama']
      : [primaryProviderType, 'openai', 'gemini', 'ollama'];
    const providerQueue: LLMProviderType[] = [...new Set(preferredOrder)].filter((p) => {
      if (p === 'ollama') return config.enableLocal;
      return config.enableCloud;
    });

    let lastError = '';
    let fallbackOccurred = false;

    for (let i = 0; i < providerQueue.length; i++) {
      const currentProviderType = providerQueue[i];
      const isFallback = i > 0;

      if (isFallback) {
        fallbackOccurred = true;
        console.log(`[AI Router] Fallback triggered. Switching to ${currentProviderType.toUpperCase()}...`);
      }

      const maxRetries = currentProviderType === 'groq' ? config.retryCount : 1;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const delayMs = Math.pow(2, attempt) * 500;
          console.log(`[AI Router] Retrying ${currentProviderType.toUpperCase()} (Attempt ${attempt + 1}/${maxRetries + 1}) after ${delayMs}ms...`);
          await new Promise((res) => setTimeout(res, delayMs));
        }

        const providerInstance =
          currentProviderType === 'openai'
            ? openaiAstraProvider
            : currentProviderType === 'groq'
              ? groqProvider
              : currentProviderType === 'gemini'
                ? geminiProvider
                : ollamaProvider;
        const response = await providerInstance.generate(request);

        if (response.success) {
          const totalLatencyMs = Date.now() - startTime;
          
          console.log(
            `[AI Router] Completed via ${response.provider.toUpperCase()} (${response.model}) | ` +
            `Latency: ${response.latency} (Total: ${totalLatencyMs}ms) | ` +
            `Tokens: ${response.tokenUsage?.totalTokens ?? 'N/A'}`
          );

          return {
            ...response,
            latencyMs: totalLatencyMs,
            latency: `${totalLatencyMs}ms`,
            fallbackOccurred: isFallback,
            fallbackReason: isFallback ? `Primary provider (${providerQueue[0]}) failed: ${lastError}` : undefined,
          };
        }

        lastError = response.error || 'Unknown provider error';
        attempts.push({
          provider: currentProviderType,
          model: response.model,
          error: lastError,
          timestamp: new Date().toISOString(),
        });

        // Auth failure, invalid key, or missing API key -> fail immediately to fallback without retrying
        if (
          lastError.includes('Missing OpenAI API Key') ||
          lastError.includes('Missing Groq API Key') ||
          lastError.includes('Auth Failure') ||
          lastError.includes('401') ||
          lastError.includes('403')
        ) {
          break;
        }
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    console.error(`[AI Router ERR] All providers failed after ${totalLatencyMs}ms. Attempts: ${JSON.stringify(attempts)}`);

    return {
      success: false,
      provider: providerQueue[0] || 'groq',
      model: 'none',
      latencyMs: totalLatencyMs,
      latency: `${totalLatencyMs}ms`,
      confidence: 0,
      output: '',
      error: `All AI Providers failed. Last error: ${lastError}`,
      diagnostics: {
        groqError: attempts.find((a) => a.provider === 'groq')?.error,
        ollamaError: attempts.find((a) => a.provider === 'ollama')?.error,
        geminiError: attempts.find((a) => a.provider === 'gemini')?.error,
        openaiError: attempts.find((a) => a.provider === 'openai')?.error,
        attempts,
      },
    };
  }

  public async getChatCompletion(prompt: string, systemPrompt?: string): Promise<string> {
    const res = await this.generate({ prompt, systemPrompt });
    if (!res.success) {
      throw new Error(`AI Router Error: ${res.error}`);
    }
    return res.output;
  }

  public async getVisionCompletion(prompt: string, imageBase64: string): Promise<string> {
    const res = await this.generate({ prompt, imageBase64 });
    if (!res.success) {
      throw new Error(`AI Router Vision Error: ${res.error}`);
    }
    return res.output;
  }

  public async getStatus(forceRefresh = false): Promise<RouterHealthStatus> {
    return healthChecker.getOverallHealth(forceRefresh);
  }

  public updateConfig(updates: Partial<RouterConfig>): RouterConfig {
    healthChecker.clearCache();
    return routerConfigManager.updateConfig(updates);
  }

  public getConfig(): RouterConfig {
    return routerConfigManager.getConfig();
  }
}

export const llmRouter = new LLMRouter();

import { LLMRequest, LLMResponse } from '../router/types';

export class GeminiProvider {
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const apiKey = this.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.startsWith('mock_')) {
      return {
        success: false,
        provider: 'gemini',
        model: this.defaultModel,
        latencyMs: Date.now() - startTime,
        latency: `${Date.now() - startTime}ms`,
        output: '',
        error: 'Missing or invalid Gemini API Key'
      };
    }

    try {
      const model = request.modelOverride || process.env.GEMINI_MODEL || 'gemini-1.5-flash';


      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const contents = [
        {
          role: 'user',
          parts: [
            ...(request.systemPrompt ? [{ text: `System Instruction: ${request.systemPrompt}` }] : []),
            { text: request.prompt }
          ]
        }
      ];

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: AbortSignal.timeout(request.timeoutMs || 30000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        provider: 'gemini',
        model,
        latencyMs,
        latency: `${latencyMs}ms`,
        output: outputText
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        provider: 'gemini',
        model: this.defaultModel,
        latencyMs,
        latency: `${latencyMs}ms`,
        output: '',
        error: `Gemini API call failed: ${err.message}`
      };
    }
  }
}

export const geminiProvider = new GeminiProvider();

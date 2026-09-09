# GPT-6 Astra Real-Time Integration

This project now uses GPT-6 Astra as the primary cloud AI model for ChipGenie and streams chat output token-by-token to the UI.

## Configure

Copy values from `.env.astra.example` into your local `.env` and set:

```env
OPENAI_API_KEY=your_real_key
OPENAI_MODEL=gpt-6-astra
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_REASONING_EFFORT=low
PREFERRED_AI_PROVIDER=openai
```

Do not expose `OPENAI_API_KEY` in Vite/frontend environment variables. The key is only read by the Express server.

## Run

```bash
npm install
npm start
```

## What changed

- `ai/providers/openaiAstraProvider.ts`: GPT-6 Astra provider using the OpenAI Responses API.
- `ai/router/types.ts`: adds the OpenAI provider and config fields.
- `ai/router/config.ts`: makes OpenAI/Astra the default cloud provider.
- `ai/router/llmRouter.ts`: routes AI calls to Astra first, then existing fallbacks.
- `server/copilotRoutes.ts`: adds `POST /api/copilot/chat-stream`, an SSE streaming proxy for Astra.
- `src/components/AiAssistantDrawer.tsx`: consumes the stream and updates the assistant response live as tokens arrive.

If `OPENAI_API_KEY` is not configured, the streaming endpoint falls back to the project's existing AI router rather than breaking the UI.

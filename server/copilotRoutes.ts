import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { AIService } from './aiService';
import { BuildContext, PlatformAdapter } from './platformAdapter';
import { ZynqPlatformAdapter } from './zynqPlatformAdapter';
import { STM32PlatformAdapter } from './stm32PlatformAdapter';

function getAdapter(presetId: string): PlatformAdapter {
  const lower = presetId.toLowerCase();
  if (lower.includes('zynq') || lower.includes('ultrascale') || lower.includes('xilinx')) {
    return new ZynqPlatformAdapter();
  } else if (lower.includes('stm32')) {
    return new STM32PlatformAdapter();
  }
  return new ZynqPlatformAdapter();
}

export const copilotRouter = Router();
const aiService = new AIService();

const PROJECTS_DIR = path.join(process.cwd(), 'workspace', 'generated', 'projects');

// Helper to read file safely
async function readFileSafely(p: string): Promise<string> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return '';
  }
}

// 1. Engineering Chat Assistant (Multi-Turn Chat Supported)
copilotRouter.post('/chat', async (req: Request, res: Response) => {
  const { sessionId, message, history } = req.body;
  if (!sessionId || !message) {
    res.status(400).json({ error: 'sessionId and message are required' });
    return;
  }

  const workspaceDir = path.join(PROJECTS_DIR, sessionId);
  const summary = await readFileSafely(path.join(workspaceDir, 'reports', 'build_summary.json'));
  const mainCode = await readFileSafely(path.join(workspaceDir, 'source', 'main.c'));
  const envRep = await readFileSafely(path.join(workspaceDir, 'reports', 'environment_report.txt'));

  const systemPrompt = `You are ChipGenie, an intelligent AI Assistant specializing in Embedded Systems, Firmware, Hardware & Software Engineering.
You work just like Gemini/ChatGPT — friendly, smart, concise, and capable of holding natural multi-turn conversations.

If project hardware context is available:
- Summary: ${summary || 'N/A'}
- Environment: ${envRep || 'N/A'}
- Main C Code: ${mainCode || 'N/A'}

Rules:
1. Answer ANY user question clearly (embedded engineering, C/C++, Python, Linux, RTOS, microcontrollers, Raspberry Pi, FPGA, or general technical questions).
2. Maintain context across the conversation.
3. Use formatted Markdown with code snippets, headers, and bullet points whenever helpful.`;

  let formattedPrompt = message;
  if (Array.isArray(history) && history.length > 0) {
    const historyText = history
      .slice(-10)
      .map((h: any) => `${h.role === 'user' ? 'User' : 'ChipGenie'}: ${h.content}`)
      .join('\n\n');
    formattedPrompt = `[Conversation History]\n${historyText}\n\nUser: ${message}`;
  }

  try {
    const answer = await aiService.getChatCompletion(formattedPrompt, systemPrompt);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b. Real-time GPT-6 Astra Engineering Chat (SSE token streaming)
copilotRouter.post('/chat-stream', async (req: Request, res: Response) => {
  const { sessionId, message, history } = req.body;
  if (!sessionId || !message) {
    res.status(400).json({ error: 'sessionId and message are required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, payload: any) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  const workspaceDir = path.join(PROJECTS_DIR, sessionId);
  const summary = await readFileSafely(path.join(workspaceDir, 'reports', 'build_summary.json'));
  const mainCode = await readFileSafely(path.join(workspaceDir, 'source', 'main.c'));
  const envRep = await readFileSafely(path.join(workspaceDir, 'reports', 'environment_report.txt'));

  const systemPrompt = `You are ChipGenie, a real-time engineering copilot powered by GPT-6 Astra.
You specialize in Embedded Systems, Firmware, Hardware/Software co-design, BSPs, FPGA, Linux, RTOS, C/C++, Python, and debugging.
Respond progressively and concisely. Never invent hardware facts; clearly distinguish project evidence from general engineering knowledge.

Project context when available:
- Summary: ${summary || 'N/A'}
- Environment: ${envRep || 'N/A'}
- Main C Code: ${mainCode || 'N/A'}`;

  let formattedPrompt = message;
  if (Array.isArray(history) && history.length > 0) {
    const historyText = history.slice(-12)
      .map((h: any) => `${h.role === 'user' ? 'User' : 'ChipGenie'}: ${h.content}`)
      .join('\n\n');
    formattedPrompt = `[Conversation History]\n${historyText}\n\nUser: ${message}`;
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-6-astra';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey.trim()) {
    // Preserve usability without an OpenAI key: existing router still provides Gemini/Ollama fallback.
    try {
      send('meta', { provider: 'fallback-router', model: 'configured fallback', realtime: false });
      const answer = await aiService.getChatCompletion(formattedPrompt, systemPrompt);
      send('delta', { delta: answer });
      send('done', { provider: 'fallback-router' });
    } catch (err: any) {
      send('error', { error: err.message || 'AI provider unavailable' });
    } finally {
      res.end();
    }
    return;
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    send('meta', { provider: 'openai', model, realtime: true });

    const openaiRes = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: formattedPrompt,
        reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
        max_output_tokens: 4096,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!openaiRes.ok || !openaiRes.body) {
      const detail = await openaiRes.text().catch(() => '');
      throw new Error(`OpenAI Astra HTTP ${openaiRes.status}: ${detail.slice(0, 500)}`);
    }

    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const raw = dataLine.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const event = JSON.parse(raw);
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            send('delta', { delta: event.delta });
          } else if (event.type === 'response.completed') {
            send('done', {
              provider: 'openai',
              model,
              responseId: event.response?.id,
              usage: event.response?.usage,
            });
          } else if (event.type === 'response.failed' || event.type === 'error') {
            send('error', { error: event.error?.message || 'Astra response failed' });
          }
        } catch {
          // Ignore keepalive/non-JSON SSE frames from upstream.
        }
      }
    }

    send('done', { provider: 'openai', model });
  } catch (err: any) {
    if (err?.name !== 'AbortError') send('error', { error: err.message || 'Astra streaming failed' });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// 2. Design Review Assistant
copilotRouter.post('/review', async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const workspaceDir = path.join(PROJECTS_DIR, sessionId);
  const summary = await readFileSafely(path.join(workspaceDir, 'reports', 'build_summary.json'));
  const dts = await readFileSafely(path.join(workspaceDir, 'source', 'system.dts'));

  const prompt = `Perform a comprehensive hardware architecture design review for the project.
Context:
${summary}
Device Tree:
${dts}

Focus on:
1. Clocks and DMA configuration issues.
2. Memory constraints and potential buffer overruns.
3. Peripheral driver consistency.
Present your findings in a structured Markdown report containing Architecture, Improvements, and Trade-offs.`;

  try {
    const report = await aiService.getChatCompletion(prompt, 'You are an expert Silicon Design and Review Engineer.');
    
    // Save report to reports directory
    const reportsDir = path.join(workspaceDir, 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(path.join(reportsDir, 'design_review.md'), report);

    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Code Explainer
copilotRouter.post('/explain', async (req: Request, res: Response) => {
  const { sessionId, filePath } = req.body;
  if (!sessionId || !filePath) {
    res.status(400).json({ error: 'sessionId and filePath are required' });
    return;
  }

  const fullPath = path.join(PROJECTS_DIR, sessionId, filePath);
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const prompt = `Explain the following code, startup assembly, linker script, or driver file line-by-line. Highlight why it was generated and how it interfaces with the physical registers.
File Path: ${filePath}
Content:
\`\`\`
${content}
\`\`\``;
    const explanation = await aiService.getChatCompletion(prompt, 'You are a Senior Firmware and Silicon Architect.');
    res.json({ explanation });
  } catch (err: any) {
    res.status(404).json({ error: `File not found or unreadable: ${filePath}` });
  }
});

// 4. Hardware Impact Analyzer
copilotRouter.post('/impact', async (req: Request, res: Response) => {
  const { sessionId, changedPeripheral } = req.body;
  if (!sessionId || !changedPeripheral) {
    res.status(400).json({ error: 'sessionId and changedPeripheral are required' });
    return;
  }

  const workspaceDir = path.join(PROJECTS_DIR, sessionId);
  const summary = await readFileSafely(path.join(workspaceDir, 'reports', 'build_summary.json'));

  const prompt = `We are changing the configuration or address map of the peripheral: "${changedPeripheral}".
Based on this design context:
${summary}

Identify all:
1. Affected drivers and BSP source/header files.
2. Clocks, interrupts, and physical pin mappings.
3. Linker memory boundaries.
4. Suggested firmware modifications.`;

  try {
    const analysis = await aiService.getChatCompletion(prompt, 'You are a Hardware Integrity Analyzer.');
    res.json({ analysis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Incremental Regeneration Engine
copilotRouter.post('/regenerate', async (req: Request, res: Response) => {
  const { sessionId, targetComponent } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const workspaceDir = path.join(PROJECTS_DIR, sessionId);
  try {
    const summaryStr = await readFileSafely(path.join(workspaceDir, 'reports', 'build_summary.json'));
    if (!summaryStr) {
      res.status(400).json({ error: 'Unable to locate previous build summary for incremental build.' });
      return;
    }
    const summary = JSON.parse(summaryStr);
    const platform = summary.platform || (sessionId.includes('stm32') ? 'stm32' : 'xilinx');
    const adapter = getAdapter(platform);

    const mockCtx: BuildContext = {
      sessionId,
      workspace: workspaceDir,
      presetId: platform,
      uploadedFileNames: [],
      bareMetalCode: await readFileSafely(path.join(workspaceDir, 'source', 'main.c')),
      deviceTreeCode: await readFileSafely(path.join(workspaceDir, 'source', 'system.dts')),
      peripherals: JSON.parse(await readFileSafely(path.join(workspaceDir, 'source', 'peripherals.json')) || '[]'),
      targetFlow: 'bare_metal',
      onLog: (type, line) => console.log(`[Regen ${type}] ${line}`),
      metadata: {},
      state: {
        envReport: summary.envReport || { valid: true, tools: [] },
        bspReport: summary.bspReport || { valid: true, presentHeaders: [], missingHeaders: [], errors: [], warnings: [] },
        elfReport: summary.elfReport || { valid: true, sections: [], errors: [], warnings: [] }
      }
    };

    console.log(`[Incremental Regen] Starting build target "${targetComponent || 'all'}" on platform "${platform}"...`);
    const buildRes = await adapter.build(mockCtx);
    
    if (buildRes.success) {
      await adapter.validateArtifacts(mockCtx);
      await adapter.generateReports(mockCtx);
      res.json({ success: true, message: 'Incremental regeneration completed successfully.', binaryPath: buildRes.binaryPath });
    } else {
      res.status(500).json({ success: false, error: buildRes.error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. AI Debug Assistant
copilotRouter.post('/debug', async (req: Request, res: Response) => {
  const { sessionId, errorMessage } = req.body;
  if (!sessionId || !errorMessage) {
    res.status(400).json({ error: 'sessionId and errorMessage are required' });
    return;
  }

  const prompt = `Analyze the following compiler/build error output:
---
${errorMessage}
---
Provide:
1. The exact root cause (e.g. missing header, linker collision).
2. Actionable fixes and required code changes.
3. Relevant compile variables or tools that need reconfiguration.`;

  try {
    const advice = await aiService.getChatCompletion(prompt, 'You are an expert Embedded Systems compiler debugger.');
    res.json({ advice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Engineering Search
copilotRouter.get('/search', async (req: Request, res: Response) => {
  const { sessionId, query } = req.query;
  if (typeof sessionId !== 'string' || typeof query !== 'string') {
    res.status(400).json({ error: 'sessionId and query are required' });
    return;
  }

  const workspaceDir = path.join(PROJECTS_DIR, sessionId);
  const results: any[] = [];

  async function searchFiles(dir: string) {
    try {
      const list = await fs.readdir(dir, { withFileTypes: true });
      for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await searchFiles(fullPath);
        } else {
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.toLowerCase().includes(String(query).toLowerCase())) {
            const relPath = path.relative(workspaceDir, fullPath).replace(/\\/g, '/');
            results.push({
              file: relPath,
              matches: content.split('\n')
                .map((line, idx) => ({ line, num: idx + 1 }))
                .filter(m => m.line.toLowerCase().includes(String(query).toLowerCase()))
                .slice(0, 5)
            });
          }
        }
      }
    } catch {}
  }

  await searchFiles(workspaceDir);
  res.json({ query, results });
});

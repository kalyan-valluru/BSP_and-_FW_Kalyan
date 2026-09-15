import dotenv from 'dotenv';
import { llmRouter } from '../ai/router/llmRouter';
import { RouterConfig } from '../ai/router/types';

dotenv.config();

export interface AIServiceConfig {
  provider: 'gemini' | 'ollama' | 'auto';
  baseUrl: string;
  model: string;
  apiKey?: string;
}

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

function fetchRagGroundedContextSync(hardwareContext: any): { evidence: any[]; grounded_prompt: string } | null {
  try {
    const cwd = process.cwd();
    const targetDir = fs.existsSync(path.join(cwd, 'semantic_retriever.py'))
      ? cwd
      : (fs.existsSync(path.join(cwd, 'server', 'semantic_retriever.py'))
        ? path.join(cwd, 'server')
        : path.join(cwd, 'backend', 'server'));
    const pyVenv1 = path.join(cwd, '.venv', 'Scripts', 'python.exe');
    const pyVenv2 = path.join(cwd, 'backend', '.venv', 'Scripts', 'python.exe');
    const pyExe = fs.existsSync(pyVenv1) ? pyVenv1 : (fs.existsSync(pyVenv2) ? pyVenv2 : 'python');

    const b64Ctx = Buffer.from(JSON.stringify(hardwareContext)).toString('base64');
    const pyCmd = `import sys, json, base64; sys.path.insert(0, r"${targetDir}"); from semantic_retriever import get_rag_grounded_context; ctx = json.loads(base64.b64decode("${b64Ctx}").decode("utf-8")); print(json.dumps(get_rag_grounded_context(ctx)))`;
    const res = spawnSync(pyExe, ['-c', pyCmd], { cwd: targetDir, encoding: 'utf-8', timeout: 10000, maxBuffer: 10 * 1024 * 1024 });

    if (res.status === 0 && res.stdout) {
      const parsed = JSON.parse(res.stdout.trim());
      if (parsed && parsed.grounded_prompt) return parsed;
    } else if (res.stderr) {
      console.warn(`[AIService RAG Warning] Python execution error: ${res.stderr}`);
    }
  } catch (err: any) {
    console.warn(`[AIService RAG Warning] RAG retrieval unavailable: ${err.message}`);
  }

  // Never manufacture register addresses, IRQs, vendor documents, or verification claims.
  // An unavailable RAG repository is an explicit evidence gap.
  const proc = hardwareContext?.processor || 'UNVERIFIED';
  return {
    evidence: [],
    grounded_prompt: [
      'HARDWARE REASONING CONTEXT:',
      `Processor: ${proc}`,
      '[AUTHORITATIVE EVIDENCE STATUS]',
      'No authoritative RAG evidence was retrieved. Do not invent hardware values.',
      'Any address, IRQ, pin, clock, memory-map, or register claim without evidence must remain unverified and require review.'
    ].join('\n')
  };
}

export function fetchMetadataRagEvidenceSync(hardwareContext: any): { processor: string; query: string; evidence_found: boolean; evidence_count: number; evidence: any[] } | null {
  try {
    const cwd = process.cwd();
    const targetDir = fs.existsSync(path.join(cwd, 'semantic_retriever.py'))
      ? cwd
      : (fs.existsSync(path.join(cwd, 'server', 'semantic_retriever.py'))
        ? path.join(cwd, 'server')
        : path.join(cwd, 'backend', 'server'));
    const pyVenv1 = path.join(cwd, '.venv', 'Scripts', 'python.exe');
    const pyVenv2 = path.join(cwd, 'backend', '.venv', 'Scripts', 'python.exe');
    const pyExe = fs.existsSync(pyVenv1) ? pyVenv1 : (fs.existsSync(pyVenv2) ? pyVenv2 : 'python');
    const b64Ctx = Buffer.from(JSON.stringify(hardwareContext)).toString('base64');
    const pyCmd = `import sys, json, base64; sys.path.insert(0, r"${targetDir}"); from semantic_retriever import resolve_metadata_evidence; ctx = json.loads(base64.b64decode("${b64Ctx}").decode("utf-8")); print(json.dumps(resolve_metadata_evidence(ctx)))`;
    const res = spawnSync(pyExe, ['-c', pyCmd], { cwd: targetDir, encoding: 'utf-8', timeout: 10000, maxBuffer: 10 * 1024 * 1024 });
    if (res.status === 0 && res.stdout) return JSON.parse(res.stdout.trim());
  } catch (err: any) {
    console.warn(`[AIService RAG Metadata Warning] Evidence retrieval error: ${err.message}`);
  }
  return null;
}

export function validateAndSanitizeGroundedAiOutput(rawOutput: string, ragEvidence: any[] = [], hardwareContext?: any): string {
  if (!hardwareContext || typeof hardwareContext !== 'object') return rawOutput;
  try {
    const cleaned = rawOutput.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let items: any[] = [];
    const isArray = cleaned.startsWith('[');
    if (isArray) items = JSON.parse(cleaned);
    else if (cleaned.startsWith('{')) items = [JSON.parse(cleaned)];
    else return rawOutput;

    const peripheralsInContext = hardwareContext.peripherals || [];
    const vendorEv = ragEvidence.filter(e => e.source_type === 'vendor' || e.sourceType === 'vendor_document');
    const projectEv = ragEvidence.filter(e => e.source_type === 'project' || e.sourceType === 'project_document' || e.sourceType === 'native_project');
    const hasAnyEvidence = vendorEv.length > 0 || projectEv.length > 0;

    const sanitizedItems = items.map(item => {
      const sanitized = { ...item };
      const blockName = item.peripheralBlock || item.name || item.hardware_item;
      const hklMatch = peripheralsInContext.find((p: any) => (p.peripheralBlock || p.name || '').toLowerCase() === (blockName || '').toLowerCase());
      const deterministicBase = hklMatch?.baseAddress && hklMatch.baseAddress !== 'N/A' && !String(hklMatch.baseAddress).includes('Unable to determine');

      if (deterministicBase) {
        sanitized.baseAddress = hklMatch.baseAddress;
        sanitized.status = sanitized.status || 'supported';
        sanitized.confidence = hklMatch.confidence || 0.95;
        sanitized.confidence_level = hklMatch.confidence_level || 'HIGH';
        return sanitized;
      }

      if (!hasAnyEvidence) {
        sanitized.status = 'insufficient_evidence';
        sanitized.baseAddress = null;
        sanitized.confidence = 0.0;
        sanitized.confidence_level = 'REQUIRES_REVIEW';
        sanitized.requires_review = true;
        return sanitized;
      }

      const itemEvidence = Array.isArray(item.evidence) ? item.evidence : [];
      if (!itemEvidence.length) {
        sanitized.status = 'requires_evidence';
        sanitized.confidence_level = 'REQUIRES_REVIEW';
        sanitized.requires_review = true;
      }
      return sanitized;
    });

    return isArray ? JSON.stringify(sanitizedItems, null, 2) : JSON.stringify(sanitizedItems[0], null, 2);
  } catch {
    return rawOutput;
  }
}

export class AIService {
  constructor() { console.log('[AIService] Initialized with Production AI Router layer.'); }

  async getChatCompletion(prompt: string, systemPrompt?: string, hardwareContext?: any): Promise<string> {
    try {
      let finalPrompt = prompt;
      let finalSystemPrompt = systemPrompt;
      let ragEvidence: any[] = [];
      if (hardwareContext && typeof hardwareContext === 'object' && Object.keys(hardwareContext).length > 0) {
        const ragRes = fetchRagGroundedContextSync(hardwareContext);
        if (ragRes?.grounded_prompt) {
          ragEvidence = ragRes.evidence || [];
          finalSystemPrompt = systemPrompt ? `${systemPrompt}\n\n${ragRes.grounded_prompt}` : ragRes.grounded_prompt;
        }
      }
      const response = await llmRouter.generate({ prompt: finalPrompt, systemPrompt: finalSystemPrompt, hardwareContext: hardwareContext || undefined });
      if (response.success && response.output) return validateAndSanitizeGroundedAiOutput(response.output, ragEvidence, hardwareContext);
      throw new Error(response.error || 'AI provider returned no output');
    } catch (error: any) {
      console.error(`[AIService ERR] getChatCompletion failed: ${error.message}`);
      throw error;
    }
  }

  async getVisionCompletion(prompt: string, imageBase64: string): Promise<string> {
    const response = await llmRouter.generate({ prompt, imageBase64, taskCategory: 'circuit_understanding' });
    if (response.success && response.output) return response.output;
    throw new Error(response.error || 'Vision provider returned no output');
  }

  async getStatus() { return llmRouter.getStatus(); }
  getConfig(): RouterConfig { return llmRouter.getConfig(); }
}

export const aiService = new AIService();
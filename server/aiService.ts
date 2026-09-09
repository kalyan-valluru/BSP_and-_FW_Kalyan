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
    const pyExe = 'python';

    const b64Ctx = Buffer.from(JSON.stringify(hardwareContext)).toString('base64');
    const pyCmd = `import sys, json, base64, os; sys.path.insert(0, r"${targetDir}"); from semantic_retriever import get_rag_grounded_context; ctx = json.loads(base64.b64decode("${b64Ctx}").decode("utf-8")); print(json.dumps(get_rag_grounded_context(ctx)))`;

    const res = spawnSync(pyExe, ['-c', pyCmd], {
      cwd: targetDir,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024
    });

    if (res.status === 0 && res.stdout) {
      const parsed = JSON.parse(res.stdout.trim());
      if (parsed && parsed.grounded_prompt) {
        return parsed;
      }
    } else if (res.stderr) {
      console.warn(`[AIService RAG Warning] Python execution error: ${res.stderr}`);
    }
  } catch (err: any) {
    console.warn(`[AIService RAG Warning] RAG context retrieval fallback: ${err.message}`);
  }
  return null;
}

export function fetchMetadataRagEvidenceSync(hardwareContext: any): { processor: string; query: string; evidence_found: boolean; evidence_count: number; evidence: any[] } | null {
  try {
    const cwd = process.cwd();
    const targetDir = fs.existsSync(path.join(cwd, 'semantic_retriever.py'))
      ? cwd
      : (fs.existsSync(path.join(cwd, 'server', 'semantic_retriever.py'))
        ? path.join(cwd, 'server')
        : path.join(cwd, 'backend', 'server'));
    const pyExe = 'python';

    const b64Ctx = Buffer.from(JSON.stringify(hardwareContext)).toString('base64');
    const pyCmd = `import sys, json, base64, os; sys.path.insert(0, r"${targetDir}"); from semantic_retriever import resolve_metadata_evidence; ctx = json.loads(base64.b64decode("${b64Ctx}").decode("utf-8")); print(json.dumps(resolve_metadata_evidence(ctx)))`;

    const res = spawnSync(pyExe, ['-c', pyCmd], {
      cwd: targetDir,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024
    });

    if (res.status === 0 && res.stdout) {
      const parsed = JSON.parse(res.stdout.trim());
      if (parsed) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn(`[AIService RAG Metadata Warning] Evidence retrieval error: ${err.message}`);
  }
  return null;
}




export function validateAndSanitizeGroundedAiOutput(
  rawOutput: string,
  ragEvidence: any[] = [],
  hardwareContext?: any
): string {
  if (!hardwareContext || typeof hardwareContext !== 'object') {
    return rawOutput;
  }

  try {
    const cleaned = rawOutput
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let items: any[] = [];
    const isArray = cleaned.startsWith('[');
    if (isArray) {
      items = JSON.parse(cleaned);
    } else if (cleaned.startsWith('{')) {
      items = [JSON.parse(cleaned)];
    } else {
      return rawOutput;
    }

    const peripheralsInContext = hardwareContext.peripherals || [];
    const vendorEv = ragEvidence.filter(e => e.source_type === 'vendor');
    const projectEv = ragEvidence.filter(e => e.source_type === 'project');
    const hasVendorEv = vendorEv.length > 0;
    const hasProjectEv = projectEv.length > 0;
    const hasAnyEvidence = hasVendorEv || hasProjectEv;

    const isConflicting = hasVendorEv && hasProjectEv && vendorEv.some(v => projectEv.some(p => {
      const vText = String(v.content || '').toLowerCase();
      const pText = String(p.content || '').toLowerCase();
      return vText.includes('0x') && pText.includes('0x') && vText !== pText;
    }));

    const sanitizedItems = items.map(item => {
      const sanitized = { ...item };
      const blockName = item.peripheralBlock || item.name || item.hardware_item;

      const hklMatch = peripheralsInContext.find((p: any) =>
        (p.peripheralBlock || p.name || '').toLowerCase() === (blockName || '').toLowerCase()
      );

      const hasDeterministicBase = hklMatch && hklMatch.baseAddress && hklMatch.baseAddress !== 'N/A' && !String(hklMatch.baseAddress).includes('Unable to determine');

      // Rule 1: Protect Deterministic HKL values
      if (hasDeterministicBase) {
        sanitized.baseAddress = hklMatch.baseAddress;
        sanitized.status = sanitized.status || 'supported';
        sanitized.confidence = hklMatch.confidence || 0.95;
        sanitized.confidence_level = hklMatch.confidence_level || 'HIGH';
        sanitized.requires_review = false;
        return sanitized;
      }

      // Rule 2: Conflicting Evidence Rule
      if (isConflicting) {
        sanitized.status = 'conflicting_evidence';
        sanitized.confidence = 0.3;
        sanitized.confidence_level = 'REQUIRES_REVIEW';
        sanitized.requires_review = true;
        return sanitized;
      }

      // Rule 3: Zero Evidence Rule (Missing evidence + No deterministic HKL base address)
      if (!hasAnyEvidence) {
        sanitized.status = 'insufficient_evidence';
        sanitized.baseAddress = null;
        sanitized.confidence = 0.0;
        sanitized.confidence_level = 'REQUIRES_REVIEW';
        sanitized.requires_review = true;
        return sanitized;
      }

      // Rule 4: Supported Evidence Available
      sanitized.status = 'supported';
      sanitized.confidence_level = 'HIGH';
      sanitized.requires_review = false;
      return sanitized;
    });

    return isArray ? JSON.stringify(sanitizedItems, null, 2) : JSON.stringify(sanitizedItems[0], null, 2);

  } catch (err) {
    return rawOutput;
  }
}

export class AIService {
  constructor() {
    console.log(`[AIService] Initialized with Production AI Router layer.`);
  }

  /**
   * Main completion method — now backed by llmRouter with auto-fallback & health checks.
   * Accepts optional hardwareContext parameter to trigger RAG grounding.
   */
  async getChatCompletion(prompt: string, systemPrompt?: string, hardwareContext?: any): Promise<string> {
    try {
      let finalPrompt = prompt;
      let finalSystemPrompt = systemPrompt;
      let ragEvidence: any[] = [];

      if (hardwareContext && (typeof hardwareContext === 'object') && Object.keys(hardwareContext).length > 0) {
        console.log(`[AIService] Hardware context detected | Executing Dual-Repository RAG Retrieval...`);
        const ragRes = fetchRagGroundedContextSync(hardwareContext);
        if (ragRes && ragRes.grounded_prompt) {
          ragEvidence = ragRes.evidence || [];
          const evidenceCount = ragEvidence.length;
          console.log(`[AIService RAG] Retrieved ${evidenceCount} evidence items. Injecting grounding into LLM prompt...`);

          finalSystemPrompt = systemPrompt
            ? `${systemPrompt}\n\n${ragRes.grounded_prompt}`
            : ragRes.grounded_prompt;
        }
      }

      const response = await llmRouter.generate({
        prompt: finalPrompt,
        systemPrompt: finalSystemPrompt,
        hardwareContext: hardwareContext || undefined
      });

      if (response.success && response.output) {
        const sanitizedOutput = validateAndSanitizeGroundedAiOutput(response.output, ragEvidence, hardwareContext);
        return sanitizedOutput;
      }

      console.warn(`[AIService] Router returned un-successful response: ${response.error || 'Empty output'}`);
      return response.output || '{}';
    } catch (error: any) {
      console.error(`[AIService ERR] getChatCompletion failed: ${error.message}`);
      throw error;
    }
  }



  /**
   * Vision completion method — backed by llmRouter
   */
  async getVisionCompletion(prompt: string, imageBase64: string): Promise<string> {
    try {
      const response = await llmRouter.generate({
        prompt,
        imageBase64,
      });

      if (response.success && response.output) {
        return response.output;
      }

      console.warn(`[AIService] Vision router returned un-successful response: ${response.error || 'Empty output'}`);
      return response.output || '[]';
    } catch (error: any) {
      console.error(`[AIService ERR] getVisionCompletion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Router status accessor
   */
  async getStatus() {
    return llmRouter.getStatus();
  }

  /**
   * Dynamic config accessor
   */
  getConfig(): RouterConfig {
    return llmRouter.getConfig();
  }
}

export const aiService = new AIService();

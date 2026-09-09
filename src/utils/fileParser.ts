import type { HardwarePeripheral } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// ── PDF.js worker setup ────────────────────────────────────────────────────
// Use the bundled legacy worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// ── NVIDIA API via Backend ──────────────────────────────────────────────────────────
// Vision model for images and Text model for netlists/PDFs are routed through /api/parse-hardware

// ── Helpers ────────────────────────────────────────────────────────────────
function generateId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data-URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}



// ── Backend API: Hardware Parsing ────────────────────────────────────────────────
async function parseHardwareViaBackend(
  fileType: 'image' | 'text',
  content?: string,
  text?: string,
  isBinary?: boolean,
  extension?: string
): Promise<{ rawOutput: string; modelUsed: string }> {
  const body: Record<string, unknown> = {
    fileType,
    content,
    text,
    isBinary,
    extension
  };

  const res = await fetch('/api/parse-hardware', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Backend API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown backend error');
  }
  
  return {
    rawOutput: data.rawOutput,
    modelUsed: data.modelUsed,
    ingestionStatus: data.ingestionStatus,
    understandingStatus: data.understandingStatus,
    verificationStatus: data.verificationStatus,
    hklStatus: data.hklStatus,
    inputType: data.inputType,
    boardDetected: data.boardDetected,
    hardwareIdentityDetected: data.hardwareIdentityDetected,
    hardwareKnowledgeLayerReady: data.hardwareKnowledgeLayerReady,
    boardName: data.boardName,
    processorName: data.processorName,
    fpgaDevice: data.fpgaDevice,
    memorySize: data.memorySize,
    flashType: data.flashType,
    architecture: data.architecture,
    hkl: data.hkl,
    peripherals: data.hkl?.peripherals || data.peripherals
  };
}

// ── Response → peripherals ─────────────────────────────────────────────────
function parseOllamaResponse(text: string): HardwarePeripheral[] {
  const peripherals: HardwarePeripheral[] = [];

  // Strip possible markdown fences
  const cleaned = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  // Find JSON array
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return peripherals;
  }

  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return peripherals;

    for (const item of arr) {
      const block = String(item.peripheralBlock || item.name || item.peripheral || '').trim();
      if (!block || block.length < 2) continue;

      const irqVal = item.interruptNumber !== undefined && item.interruptNumber !== null && item.interruptNumber !== '' && item.interruptNumber !== 'N/A'
        ? (!isNaN(Number(item.interruptNumber)) ? Number(item.interruptNumber) : String(item.interruptNumber))
        : undefined;

      peripherals.push({
        id: item.id || generateId(),
        peripheralBlock: block,
        type: item.type || undefined,
        driverName: item.driverName || undefined,
        version: item.version || '1.0',
        bus: item.bus || undefined,
        clockSource: item.clockSource || undefined,
        clockFrequency: item.clockFrequency || undefined,
        baseAddress: String(item.baseAddress || item.address || item.base_address || '0x00000000').trim().toUpperCase(),
        addressRange: item.addressRange || undefined,
        physicalPinMapping: String(item.physicalPinMapping || item.pins || item.pin_mapping || 'N/A').trim(),
        clockNetIndicator: Boolean(item.clockNetIndicator ?? item.clock ?? false),
        interruptNumber: irqVal,
        dma: item.dma || 'Disabled',
        operatingMode: item.operatingMode || (irqVal !== undefined ? 'Interrupt' : 'Polling'),
        status: item.status || 'Active',
        confidence: item.confidence || 95,
        fieldStatuses: item.fieldStatuses || {},
        verification_status: item.verification_status,
        provenanceSource: item.provenanceSource,
        requires_review: item.requires_review,
        baseAddress_meta: item.baseAddress_meta,
      } as any);

    }
  } catch {
    // JSON parse failed — try line-by-line fallback
    const lines = cleaned.split('\n');
    for (const line of lines) {
      const parts = line.split(/[|,\t]/).map((s) => s.trim());
      if (parts.length >= 2 && parts[0] && !/^[-=#*{}[\]]/.test(parts[0])) {
        const block = parts[0];
        const pins = parts[1] || 'N/A';
        const addr = parts.find((p) => /^0x[0-9A-Fa-f]+$/i.test(p)) || '0x00000000';
        if (block.length > 1 && block.length < 40) {
          peripherals.push({
            id: generateId(),
            peripheralBlock: block,
            physicalPinMapping: pins,
            clockNetIndicator: /clk|uart|spi|i2c|can|eth|usb/i.test(block),
            baseAddress: addr.toUpperCase(),
          });
        }
      }
    }
  }

  return peripherals;
}

// ── Netlist regex fallback (fast, no LLM needed) ───────────────────────────
function parseNetlistRegex(text: string): HardwarePeripheral[] {
  const peripherals: HardwarePeripheral[] = [];
  const seen = new Set<string>();

  // KiCad: (comp (ref U1) (value UART) ...)
  const compPattern = /\(comp\s+\(ref\s+(\S+)\)\s+\(value\s+([^)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = compPattern.exec(text)) !== null) {
    const ref = m[1].trim();
    const value = m[2].trim();
    if (!seen.has(ref)) {
      seen.add(ref);
      peripherals.push({
        id: generateId(),
        peripheralBlock: `${value} (${ref})`,
        physicalPinMapping: ref,
        clockNetIndicator: /clk|uart|spi|i2c|can|eth/i.test(value),
        baseAddress: '0x00000000',
      });
    }
  }

  // SPICE .subckt
  const subcktPattern = /^\.(subckt|module)\s+(\S+)/gim;
  while ((m = subcktPattern.exec(text)) !== null) {
    const name = m[2].trim();
    if (!seen.has(name)) {
      seen.add(name);
      peripherals.push({
        id: generateId(),
        peripheralBlock: name,
        physicalPinMapping: 'N/A',
        clockNetIndicator: /clk|uart|spi|i2c/i.test(name),
        baseAddress: '0x00000000',
      });
    }
  }

  // PERIPHERAL @ 0xADDR
  const addrPattern = /(\w+)\s+@\s+(0x[0-9A-Fa-f]+)/g;
  while ((m = addrPattern.exec(text)) !== null) {
    const name = m[1].trim();
    const addr = m[2].trim().toUpperCase();
    const existing = peripherals.find((p) => p.peripheralBlock.includes(name));
    if (existing) {
      existing.baseAddress = addr;
    } else if (!seen.has(name)) {
      seen.add(name);
      peripherals.push({
        id: generateId(),
        peripheralBlock: name,
        physicalPinMapping: 'N/A',
        clockNetIndicator: /clk|uart|spi|i2c/i.test(name),
        baseAddress: addr,
      });
    }
  }

  return peripherals;
}

// ── Public API ─────────────────────────────────────────────────────────────
export interface ParseResult {
  peripherals: HardwarePeripheral[];
  /** Which strategy was used */
  method: 'ollama-vision' | 'ollama-text' | 'regex' | 'unsupported';
  modelUsed?: string;
  error?: string;
  ingestionStatus?: 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED';
  understandingStatus?: 'VERIFIED' | 'UNVERIFIED' | 'CONFLICT';
  verificationStatus?: string;
  hklStatus?: 'READY' | 'NOT_READY';
  inputType?: string;
  boardDetected?: boolean;
  hardwareIdentityDetected?: boolean;
  hardwareKnowledgeLayerReady?: boolean;
  boardName?: string;
  processorName?: string;
  fpgaDevice?: string;
  memorySize?: string;
  flashType?: string;
  architecture?: string;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';

  const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.svg'];
  const binaryExtensions = ['.pdf', '.docx', '.xlsx', '.xls', '.zip', '.xsa', '.xpr'];

  // 1. Image Formats
  if (imageExtensions.includes(ext)) {
    try {
      const base64 = await fileToBase64(file);
      const response = await parseHardwareViaBackend('image', base64, undefined, true, ext);
      const peripherals = parseOllamaResponse(response.rawOutput);
      const isCompleted = response.ingestionStatus === 'COMPLETED' && response.hklStatus === 'READY';
      return {
        peripherals,
        method: 'ollama-vision',
        modelUsed: response.modelUsed,
        ingestionStatus: isCompleted ? 'COMPLETED' : 'REQUIRES_REVIEW',
        understandingStatus: response.understandingStatus || (isCompleted ? 'VERIFIED' : 'UNVERIFIED'),
        hklStatus: response.hklStatus || (isCompleted ? 'READY' : 'NOT_READY'),
        inputType: response.inputType || 'BOARD_IMAGE',
        boardDetected: response.boardDetected ?? (peripherals.length > 0),
        hardwareIdentityDetected: response.hardwareIdentityDetected ?? (peripherals.length > 0),
        verificationStatus: response.verificationStatus || (isCompleted ? 'DETERMINISTIC_VERIFIED' : 'REQUIRES_MANUAL_REVIEW'),
        hardwareKnowledgeLayerReady: isCompleted,
        boardName: response.boardName,
        processorName: response.processorName,
        fpgaDevice: response.fpgaDevice,
        memorySize: response.memorySize,
        flashType: response.flashType,
        architecture: response.architecture
      };
    } catch (error) {
      console.warn("Vision model failed:", error);
      return {
        peripherals: [],
        ingestionStatus: 'REQUIRES_REVIEW',
        understandingStatus: 'UNVERIFIED',
        hklStatus: 'NOT_READY',
        boardDetected: false,
        hardwareIdentityDetected: false,
        verificationStatus: 'REQUIRES_MANUAL_REVIEW',
        hardwareKnowledgeLayerReady: false,
        method: 'ollama-vision',
        modelUsed: 'DeepReader',
      };
    }
  }

  // 2. Binary Document Formats (PDF, DOCX, XLSX, ZIP)
  if (binaryExtensions.includes(ext)) {
    try {
      const base64 = await fileToBase64(file);
      const response = await parseHardwareViaBackend('text', undefined, base64, true, ext);
      const peripherals = (response.peripherals && response.peripherals.length > 0) 
        ? response.peripherals 
        : parseOllamaResponse(response.rawOutput);
      const isCompleted = response.ingestionStatus === 'COMPLETED' && response.hklStatus === 'READY';
      return {
        peripherals,
        method: 'ollama-text',
        modelUsed: response.modelUsed,
        ingestionStatus: response.ingestionStatus || (isCompleted ? 'COMPLETED' : 'REQUIRES_REVIEW'),
        understandingStatus: response.understandingStatus || (isCompleted ? 'VERIFIED' : 'UNVERIFIED'),
        hklStatus: response.hklStatus || (isCompleted ? 'READY' : 'NOT_READY'),
        inputType: response.inputType || (ext === '.pdf' ? 'BOARD_IMAGE' : 'DOCUMENT'),
        boardDetected: response.boardDetected ?? false,
        hardwareIdentityDetected: response.hardwareIdentityDetected ?? false,
        verificationStatus: response.verificationStatus || (isCompleted ? 'DETERMINISTIC_VERIFIED' : 'REQUIRES_MANUAL_REVIEW'),
        hardwareKnowledgeLayerReady: isCompleted,
        boardName: response.boardName,
        processorName: response.processorName,
        fpgaDevice: response.fpgaDevice,
        memorySize: response.memorySize,
        flashType: response.flashType,
        architecture: response.architecture
      };
    } catch (error) {
      console.warn("Binary document parser failed:", error);
      return {
        peripherals: [],
        ingestionStatus: 'REQUIRES_REVIEW',
        understandingStatus: 'UNVERIFIED',
        hklStatus: 'NOT_READY',
        boardDetected: false,
        hardwareIdentityDetected: false,
        verificationStatus: 'REQUIRES_MANUAL_REVIEW',
        hardwareKnowledgeLayerReady: false,
        method: 'ollama-text',
        modelUsed: 'DeepReader',
      };
    }
  }

  // 3. Plain Text / Code / Netlists
  try {
    const text = await readAsText(file);
    try {
      const response = await parseHardwareViaBackend('text', undefined, text, false, ext);
      const peripherals = parseOllamaResponse(response.rawOutput);
      if (peripherals.length > 0) {
        return { peripherals, method: 'ollama-text', modelUsed: response.modelUsed };
      }
    } catch {
      // API unavailable — fall back to regex
    }

    // Regex fallback
    const peripherals = parseNetlistRegex(text);
    return { peripherals, method: 'regex' };
  } catch (error) {
    console.warn("Regex/Text parser failed, using mock fallback:", error);
    return {
      peripherals: [],
      status: 'insufficient_evidence',
      requires_review: true,
      method: 'regex',
      modelUsed: 'DeepReader',
    };
  }
}

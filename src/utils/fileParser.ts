import type { HardwarePeripheral } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

function generateId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

interface BackendParseResponse {
  rawOutput: string;
  modelUsed: string;
  ingestionStatus?: ParseResult['ingestionStatus'];
  understandingStatus?: ParseResult['understandingStatus'];
  verificationStatus?: string;
  hklStatus?: ParseResult['hklStatus'];
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
  hkl?: { peripherals?: HardwarePeripheral[] };
  peripherals?: HardwarePeripheral[];
}

async function parseHardwareViaBackend(
  fileType: 'image' | 'text',
  content?: string,
  text?: string,
  isBinary?: boolean,
  extension?: string
): Promise<BackendParseResponse> {
  const res = await fetch('/api/parse-hardware', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileType, content, text, isBinary, extension }),
  });
  if (!res.ok) throw new Error(`Backend API error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Hardware parsing failed');
  return data as BackendParseResponse;
}

function parseOllamaResponse(text: string): HardwarePeripheral[] {
  const peripherals: HardwarePeripheral[] = [];
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) return peripherals;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return peripherals;
    for (const item of arr) {
      const block = String(item?.peripheralBlock || item?.name || item?.peripheral || '').trim();
      if (block.length < 2) continue;
      const irqRaw = item?.interruptNumber;
      const irq = irqRaw !== undefined && irqRaw !== null && irqRaw !== '' && irqRaw !== 'N/A'
        ? (!Number.isNaN(Number(irqRaw)) ? Number(irqRaw) : String(irqRaw))
        : undefined;
      const baseAddress = item?.baseAddress ?? item?.address ?? item?.base_address;
      const pinMapping = item?.physicalPinMapping ?? item?.pins ?? item?.pin_mapping;
      peripherals.push({
        id: item?.id || generateId(),
        peripheralBlock: block,
        type: item?.type || undefined,
        driverName: item?.driverName || undefined,
        version: item?.version || undefined,
        bus: item?.bus || undefined,
        clockSource: item?.clockSource || undefined,
        clockFrequency: item?.clockFrequency || undefined,
        baseAddress: baseAddress ? String(baseAddress).trim().toUpperCase() : '',
        addressRange: item?.addressRange || undefined,
        physicalPinMapping: pinMapping ? String(pinMapping).trim() : '',
        clockNetIndicator: Boolean(item?.clockNetIndicator ?? item?.clock ?? false),
        interruptNumber: irq,
        dma: item?.dma || undefined,
        operatingMode: item?.operatingMode || undefined,
        status: item?.status || 'insufficient_evidence',
        confidence: typeof item?.confidence === 'number' ? item.confidence : undefined,
        fieldStatuses: item?.fieldStatuses || {},
        verification_status: item?.verification_status,
        provenanceSource: item?.provenanceSource,
        requires_review: item?.requires_review,
        baseAddress_meta: item?.baseAddress_meta,
        provenance: item?.provenance,
      });
    }
  } catch {
    return peripherals;
  }
  return peripherals;
}

function parseNetlistRegex(text: string): HardwarePeripheral[] {
  const peripherals: HardwarePeripheral[] = [];
  const seen = new Set<string>();
  const compPattern = /\(comp\s+\(ref\s+(\S+)\)\s+\(value\s+([^)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = compPattern.exec(text)) !== null) {
    const ref = m[1].trim();
    const value = m[2].trim();
    if (seen.has(ref)) continue;
    seen.add(ref);
    peripherals.push({ id: generateId(), peripheralBlock: `${value} (${ref})`, physicalPinMapping: ref, clockNetIndicator: /clk|uart|spi|i2c|can|eth/i.test(value), baseAddress: '' });
  }
  const subcktPattern = /^\.(subckt|module)\s+(\S+)/gim;
  while ((m = subcktPattern.exec(text)) !== null) {
    const name = m[2].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    peripherals.push({ id: generateId(), peripheralBlock: name, physicalPinMapping: '', clockNetIndicator: /clk|uart|spi|i2c/i.test(name), baseAddress: '' });
  }
  const addrPattern = /(\w+)\s+@\s+(0x[0-9A-Fa-f]+)/g;
  while ((m = addrPattern.exec(text)) !== null) {
    const name = m[1].trim();
    const addr = m[2].toUpperCase();
    const existing = peripherals.find(p => p.peripheralBlock.includes(name));
    if (existing) existing.baseAddress = addr;
    else if (!seen.has(name)) {
      seen.add(name);
      peripherals.push({ id: generateId(), peripheralBlock: name, physicalPinMapping: '', clockNetIndicator: /clk|uart|spi|i2c/i.test(name), baseAddress: addr });
    }
  }
  return peripherals;
}

export interface ParseResult {
  peripherals: HardwarePeripheral[];
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
  hkl?: { peripherals?: HardwarePeripheral[] };
}

function resultFromBackend(response: BackendParseResponse, method: ParseResult['method'], fallbackInputType: string): ParseResult {
  const peripherals = response.hkl?.peripherals?.length
    ? response.hkl.peripherals
    : response.peripherals?.length
      ? response.peripherals
      : parseOllamaResponse(response.rawOutput || '');
  return {
    peripherals,
    method,
    modelUsed: response.modelUsed,
    ingestionStatus: response.ingestionStatus || 'REQUIRES_REVIEW',
    understandingStatus: response.understandingStatus || 'UNVERIFIED',
    verificationStatus: response.verificationStatus || 'REQUIRES_MANUAL_REVIEW',
    hklStatus: response.hklStatus || 'NOT_READY',
    inputType: response.inputType || fallbackInputType,
    boardDetected: response.boardDetected ?? false,
    hardwareIdentityDetected: response.hardwareIdentityDetected ?? false,
    hardwareKnowledgeLayerReady: response.hardwareKnowledgeLayerReady ?? false,
    boardName: response.boardName,
    processorName: response.processorName,
    fpgaDevice: response.fpgaDevice,
    memorySize: response.memorySize,
    flashType: response.flashType,
    architecture: response.architecture,
    hkl: response.hkl,
  };
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.svg'];
  const binaryExtensions = ['.pdf', '.docx', '.xlsx', '.xls', '.zip', '.xsa', '.xpr'];

  if (imageExtensions.includes(ext)) {
    try {
      const base64 = await fileToBase64(file);
      return resultFromBackend(await parseHardwareViaBackend('image', base64, undefined, true, ext), 'ollama-vision', 'BOARD_IMAGE');
    } catch (error) {
      return { peripherals: [], ingestionStatus: 'REQUIRES_REVIEW', understandingStatus: 'UNVERIFIED', hklStatus: 'NOT_READY', boardDetected: false, hardwareIdentityDetected: false, verificationStatus: 'REQUIRES_MANUAL_REVIEW', hardwareKnowledgeLayerReady: false, method: 'ollama-vision', modelUsed: 'unavailable', error: String(error) };
    }
  }

  if (binaryExtensions.includes(ext)) {
    try {
      const base64 = await fileToBase64(file);
      return resultFromBackend(await parseHardwareViaBackend('text', undefined, base64, true, ext), 'ollama-text', ext === '.pdf' ? 'BOARD_DOCUMENT' : 'DOCUMENT');
    } catch (error) {
      return { peripherals: [], ingestionStatus: 'REQUIRES_REVIEW', understandingStatus: 'UNVERIFIED', hklStatus: 'NOT_READY', boardDetected: false, hardwareIdentityDetected: false, verificationStatus: 'REQUIRES_MANUAL_REVIEW', hardwareKnowledgeLayerReady: false, method: 'ollama-text', modelUsed: 'unavailable', error: String(error) };
    }
  }

  try {
    const text = await readAsText(file);
    try {
      const response = await parseHardwareViaBackend('text', undefined, text, false, ext);
      const result = resultFromBackend(response, 'ollama-text', 'TEXT_DOCUMENT');
      if (result.peripherals.length > 0 || result.hardwareKnowledgeLayerReady) return result;
    } catch {
      // Deterministic netlist parsing remains available for text inputs.
    }
    return { peripherals: parseNetlistRegex(text), method: 'regex', ingestionStatus: 'REQUIRES_REVIEW', understandingStatus: 'UNVERIFIED', hklStatus: 'NOT_READY', hardwareKnowledgeLayerReady: false, verificationStatus: 'REQUIRES_MANUAL_REVIEW' };
  } catch (error) {
    return { peripherals: [], method: 'unsupported', ingestionStatus: 'FAILED', understandingStatus: 'UNVERIFIED', hklStatus: 'NOT_READY', hardwareKnowledgeLayerReady: false, verificationStatus: 'FAILED', error: String(error) };
  }
}

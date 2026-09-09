import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { discoverVendorDocuments } from './vendor/vendorDocumentDiscovery';
import { downloadVendorDocument, VendorManifestManager } from './vendor/vendorDocumentDownloader';
import { ingestVendorDocumentIntoRag } from './vendorRagIngestion';
import { VENDOR_DOCUMENT_REGISTRY } from './vendor/vendorDocumentRegistry';
import { DynamicVendorBoardFetcher } from './dynamicVendorBoardFetcher';

export interface KnowledgeEnsureRequest {
  board: string;
  device?: string;
  vendor?: string;
  architecture?: string;
  flow?: 'bare-metal' | 'linux' | 'both';
  peripherals?: string[];
}

export interface KnowledgeEnsureResult {
  success: boolean;
  board: string;
  vendor: string;
  cached: boolean;
  downloaded: string[];
  ingested: string[];
  skipped: string[];
  errors: string[];
  manifestPath: string;
}

const KB_ROOT = path.join(process.cwd(), 'workspace', 'vendor_knowledge');
const INDEX_PATH = path.join(KB_ROOT, 'knowledge_index.json');

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function loadIndex(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')); } catch { return {}; }
}

function saveIndex(index: Record<string, any>) {
  fs.mkdirSync(KB_ROOT, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function detectVendor(board: string, device = '', vendor?: string): string {
  if (vendor) return vendor;
  const s = `${board} ${device}`.toLowerCase();
  if (/stm32|discovery|nucleo/.test(s)) return 'STMicroelectronics';
  if (/zynq|zcu|zedboard|versal|xilinx/.test(s)) return 'AMD';
  if (/imx|nxp|evk/.test(s)) return 'NXP';
  if (/sitara|am62|am64|am335|ti /.test(s)) return 'Texas Instruments';
  if (/jetson|orin|tegra/.test(s)) return 'NVIDIA';
  if (/raspberry|rp2040|rp2350|compute module/.test(s)) return 'Raspberry Pi';
  return 'UNKNOWN';
}

function documentNeeded(type: string, flow: KnowledgeEnsureRequest['flow'], peripherals: string[]): boolean {
  const t = type.toLowerCase();
  if (t.includes('datasheet')) return true;
  if (t.includes('reference') || t === 'trm') return true;
  if (t.includes('board') || t.includes('userguide')) return true;
  if (t.includes('errata')) return true;
  if (flow === 'linux' || flow === 'both') {
    if (t.includes('bsp') || t.includes('driver') || t.includes('device') || t.includes('programming')) return true;
  }
  if (peripherals.some(p => /axi|gpio|uart|spi|i2c|timer|dma/i.test(p))) {
    if (t.includes('productguide') || t.includes('application')) return true;
  }
  return false;
}

/**
 * Ensures the minimum authoritative knowledge for a requested board exists locally.
 * Unknown boards are acquired on demand. Only URLs passing the vendor allow-list are
 * eligible for download; search/discovery results themselves are never trusted as sources.
 */
export async function ensureBoardKnowledge(req: KnowledgeEnsureRequest): Promise<KnowledgeEnsureResult> {
  const vendor = detectVendor(req.board, req.device, req.vendor);
  const result: KnowledgeEnsureResult = {
    success: false, board: req.board, vendor, cached: false, downloaded: [], ingested: [], skipped: [], errors: [],
    manifestPath: path.join(KB_ROOT, 'manifest.json')
  };
  if (vendor === 'UNKNOWN') {
    result.errors.push(`Cannot determine vendor for '${req.board}'. Ask for the vendor or exact device part before downloading.`);
    return result;
  }

  const key = `${vendor}:${req.board}:${req.device || ''}`.toLowerCase();
  const index = loadIndex();
  const manifest = VendorManifestManager.loadManifest();
  const existing = Object.values(manifest).filter((m: any) =>
    String(m.vendor).toLowerCase() === vendor.toLowerCase() &&
    String(m.deviceFamily || '').toLowerCase().includes((req.device || req.board).toLowerCase())
  );
  if (existing.length > 0) {
    result.cached = true;
    result.skipped.push(...existing.map((m: any) => m.documentId));
  }

  let docs: any[] = [];
  try {
    docs = await discoverVendorDocuments({
      vendor,
      architecture: req.architecture,
      device: req.device,
      board: req.board,
      peripheral: (req.peripherals || []).join(',')
    });
  } catch (e: any) {
    result.errors.push(`Official document discovery failed: ${e.message}`);
  }

  // If the board is not in the static registry, use the live official-domain fetcher.
  if (!docs.length || vendor === 'UNKNOWN') {
    try {
      const fetcher = new DynamicVendorBoardFetcher(path.join(KB_ROOT, 'raw'));
      const live = await fetcher.fetchBoardDocumentation({ processorName: req.device || req.board, vendorName: vendor });
      if (live.success) {
        result.downloaded.push(...live.downloadedFiles);
        index[key] = { board: req.board, device: req.device || null, vendor, acquiredAt: new Date().toISOString(), source: 'OFFICIAL_VENDOR' };
        saveIndex(index);
        result.success = true;
        return result;
      }
      result.errors.push(live.message);
    } catch (e: any) {
      result.errors.push(`Live official documentation acquisition failed: ${e.message}`);
    }
  }

  for (const doc of docs) {
    if (!documentNeeded(doc.documentType, req.flow, req.peripherals || [])) {
      result.skipped.push(`${doc.documentId}: not required for this flow`);
      continue;
    }
    const cached = manifest[doc.documentId];
    if (cached && fs.existsSync(cached.localPath)) {
      result.cached = true;
      result.skipped.push(`${doc.documentId}: cached`);
      continue;
    }
    const dl = await downloadVendorDocument({
      documentId: doc.documentId,
      vendor: doc.vendor,
      title: doc.title,
      documentNumber: doc.documentNumber,
      revision: doc.revision,
      publicationDate: doc.publicationDate,
      officialUrl: doc.officialUrl,
      sourceDomain: doc.sourceDomain,
      documentType: doc.documentType as any,
      deviceFamily: doc.deviceFamily
    });
    if (!dl.success || !dl.entry) {
      result.errors.push(`${doc.documentId}: ${dl.error || 'download failed'}`);
      continue;
    }
    result.downloaded.push(doc.documentId);
    const ing = await ingestVendorDocumentIntoRag({
      local_path: dl.entry.localPath,
      title: doc.title,
      vendor: doc.vendor,
      product: doc.deviceFamily || req.device || req.board,
      document_type: doc.documentType,
      revision: doc.revision,
      source_url: doc.officialUrl,
      sha256: dl.entry.sha256,
      authority: 'OFFICIAL_VENDOR'
    } as any);
    if (ing.success) result.ingested.push(`${doc.documentId}:${ing.chunksIngested}`);
    else result.errors.push(`${doc.documentId}: RAG ingestion failed: ${ing.error}`);
  }

  index[key] = {
    board: req.board,
    device: req.device || null,
    vendor,
    acquiredAt: new Date().toISOString(),
    documents: result.downloaded,
    ingested: result.ingested,
    officialOnly: true
  };
  saveIndex(index);
  result.success = result.errors.length === 0 && (result.downloaded.length + result.ingested.length + result.skipped.length) > 0;
  return result;
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { VendorDocumentMeta, isApprovedVendorDomain } from './vendorDocumentRegistry';

export interface VendorManifestEntry {
  documentId: string;
  vendor: string;
  deviceFamily: string;
  revision: string;
  sha256: string;
  officialUrl: string;
  downloadedAt: string;
  status: 'VERIFIED_DOWNLOAD' | 'CACHED' | 'FAILED';
  localPath: string;
}

/**
 * Master Manifest Manager for workspace/vendor_knowledge/manifest.json
 */
export class VendorManifestManager {
  private static manifestPath(): string {
    const workspaceDir = path.join(process.cwd(), 'workspace', 'vendor_knowledge');
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    return path.join(workspaceDir, 'manifest.json');
  }

  public static loadManifest(): Record<string, VendorManifestEntry> {
    const p = this.manifestPath();
    if (!fs.existsSync(p)) return {};
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }

  public static saveEntry(entry: VendorManifestEntry): void {
    const manifest = this.loadManifest();
    manifest[entry.documentId] = entry;
    fs.writeFileSync(this.manifestPath(), JSON.stringify(manifest, null, 2), 'utf-8');
  }

  public static getEntry(documentId: string): VendorManifestEntry | undefined {
    return this.loadManifest()[documentId];
  }
}

/**
 * Phase 3: Vendor Document Downloader
 */
export async function downloadVendorDocument(
  doc: VendorDocumentMeta
): Promise<{ success: boolean; entry?: VendorManifestEntry; cached?: boolean; error?: string }> {
  try {
    // 1. Verify URL is from approved official domain allowlist
    if (!isApprovedVendorDomain(doc.officialUrl, doc.vendor)) {
      return {
        success: false,
        error: `Security Violation: Domain '${doc.sourceDomain}' for URL '${doc.officialUrl}' is not on the official approved allowlist for '${doc.vendor}'.`
      };
    }

    // 2. Check document cache manifest
    const existing = VendorManifestManager.getEntry(doc.documentId);
    if (existing && fs.existsSync(existing.localPath)) {
      console.log(`[VENDOR-DOC] Document '${doc.documentId}' (${doc.title}) is already present in cache. Skipping download.`);
      return { success: true, entry: existing, cached: true };
    }

    // 3. Prepare storage directory under workspace/vendor_knowledge/<vendor>/<device-family>/
    const targetDir = path.join(
      process.cwd(),
      'workspace',
      'vendor_knowledge',
      doc.vendor.replace(/[^a-zA-Z0-9_-]/g, '_'),
      (doc.deviceFamily || 'General').replace(/[^a-zA-Z0-9_-]/g, '_')
    );

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFilename = `${doc.documentId}_${doc.documentNumber}_rev${doc.revision}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localFilePath = path.join(targetDir, safeFilename);

    console.log(`[VENDOR-DOC] Downloading official document '${doc.documentId}' from ${doc.officialUrl}...`);
    const buffer = await fetchBufferFromUrl(doc.officialUrl);

    if (!buffer || buffer.length === 0 || buffer.slice(0, 4).toString() !== '%PDF') {
      return { success: false, error: `Official source did not return a PDF document for '${doc.documentId}'. No synthetic or placeholder content was created.` };
    }

    // Calculate SHA-256 hash
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    fs.writeFileSync(localFilePath, buffer);

    const entry: VendorManifestEntry = {
      documentId: doc.documentId,
      vendor: doc.vendor,
      deviceFamily: doc.deviceFamily || 'General',
      revision: doc.revision,
      sha256,
      officialUrl: doc.officialUrl,
      downloadedAt: new Date().toISOString(),
      status: 'VERIFIED_DOWNLOAD',
      localPath: localFilePath
    };

    VendorManifestManager.saveEntry(entry);
    console.log(`[VENDOR-DOC] Successfully downloaded '${doc.documentId}' (${buffer.length} bytes, SHA256: ${sha256.slice(0, 12)}...).`);
    return { success: true, entry, cached: false };

  } catch (err: any) {
    return { success: false, error: `Download failed: ${err.message}` };
  }
}

function fetchBufferFromUrl(urlStr: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const client = urlStr.startsWith('https') ? https : http;
      client.get(urlStr, { timeout: 8000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchBufferFromUrl(res.headers.location).then(resolve);
        }
        if (res.statusCode !== 200) return resolve(null);
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

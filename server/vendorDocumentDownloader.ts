import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { DiscoveredVendorDocument } from './officialVendorSourceDiscovery';
import { isAuthoritativeVendorUrl } from './officialVendorRegistry';

export interface DownloadedVendorDocumentMeta {
  vendor: string;
  product: string;
  document_type: string;
  title: string;
  source_url: string;
  official_domain: boolean;
  version: string;
  revision?: string;
  downloaded_at: string;
  sha256: string;
  authority: 'OFFICIAL_VENDOR' | 'VERIFIED_VENDOR_REPO';
  source_type: 'VENDOR_DOCUMENT';
  local_path: string;
}

/**
 * Calculate SHA-256 hash of a file or buffer
 */
export function calculateSha256(data: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Phase 5: Vendor Document Download Manager
 * Downloads public official vendor documents, calculates SHA-256 hashes, prevents duplicates,
 * and saves files with metadata sidecars under vendor_knowledge/<Vendor>/<Product>/<DocType>/.
 */
export async function downloadVendorDocument(
  doc: DiscoveredVendorDocument
): Promise<{ success: boolean; meta?: DownloadedVendorDocumentMeta; error?: string }> {
  try {
    // 1. Verify URL is from an authoritative official vendor domain
    if (!isAuthoritativeVendorUrl(doc.document_url, doc.vendor)) {
      return {
        success: false,
        error: `URL '${doc.document_url}' is not from an authoritative official domain for vendor '${doc.vendor}'.`
      };
    }

    // 2. Prepare local storage directory
    const projectRoot = process.cwd();
    const vendorDir = path.join(
      projectRoot,
      'backend',
      'server',
      'data',
      'vendor_knowledge',
      doc.vendor.replace(/[^a-zA-Z0-9_-]/g, '_'),
      doc.product.replace(/[^a-zA-Z0-9_-]/g, '_'),
      doc.document_type.replace(/[^a-zA-Z0-9_-]/g, '_')
    );

    if (!fs.existsSync(vendorDir)) {
      fs.mkdirSync(vendorDir, { recursive: true });
    }

    const safeTitle = doc.document_title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeTitle}.pdf`;
    const localFilePath = path.join(vendorDir, fileName);
    const metaFilePath = path.join(vendorDir, `${safeTitle}.meta.json`);

    // 3. Check for existing duplicate document
    if (fs.existsSync(localFilePath) && fs.existsSync(metaFilePath)) {
      try {
        const existingMeta: DownloadedVendorDocumentMeta = JSON.parse(fs.readFileSync(metaFilePath, 'utf-8'));
        console.log(`[DOWNLOAD MANAGER] Document '${doc.document_title}' already exists locally (SHA256: ${existingMeta.sha256.slice(0, 12)}...). Skipping download.`);
        return { success: true, meta: existingMeta };
      } catch (err) {
        // Corrupt meta file, proceed to redownload safely
      }
    }

    // 4. Download file contents safely
    console.log(`[DOWNLOAD MANAGER] Downloading official document from '${doc.document_url}'...`);
    const fileBuffer = await fetchBufferFromUrl(doc.document_url);

    if (!fileBuffer || fileBuffer.length === 0) {
      return { success: false, error: `Empty response or download failure for '${doc.document_url}'.` };
    }

    // 5. Calculate SHA-256 hash & verify integrity
    const sha256 = calculateSha256(fileBuffer);
    const nowStr = new Date().toISOString();

    const meta: DownloadedVendorDocumentMeta = {
      vendor: doc.vendor,
      product: doc.product,
      document_type: doc.document_type,
      title: doc.document_title,
      source_url: doc.document_url,
      official_domain: true,
      version: doc.version,
      revision: doc.revision,
      downloaded_at: nowStr,
      sha256,
      authority: doc.source_authority,
      source_type: 'VENDOR_DOCUMENT',
      local_path: localFilePath
    };

    // 6. Write file & metadata sidecar
    fs.writeFileSync(localFilePath, fileBuffer);
    fs.writeFileSync(metaFilePath, JSON.stringify(meta, null, 2), 'utf-8');

    console.log(`[DOWNLOAD MANAGER] Successfully saved '${doc.document_title}' (${fileBuffer.length} bytes, SHA256: ${sha256.slice(0, 12)}...)`);
    return { success: true, meta };

  } catch (err: any) {
    return { success: false, error: `Download failed: ${err.message}` };
  }
}

/**
 * Helper to download Buffer from HTTP/HTTPS URL
 */
function fetchBufferFromUrl(urlStr: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const client = urlStr.startsWith('https') ? https : http;
      client.get(urlStr, { timeout: 10000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          return fetchBufferFromUrl(res.headers.location).then(resolve);
        }
        if (res.statusCode !== 200) {
          console.warn(`[DOWNLOAD MANAGER] HTTP ${res.statusCode} for ${urlStr}`);
          return resolve(null);
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      }).on('error', (err) => {
        console.warn(`[DOWNLOAD MANAGER] Network error fetching ${urlStr}: ${err.message}`);
        resolve(null);
      });
    } catch (err) {
      resolve(null);
    }
  });
}

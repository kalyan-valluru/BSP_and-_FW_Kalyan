import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, 'knowledge_base', 'official', 'official_catalog.json');
const VENDOR_KNOWLEDGE_ROOT = path.join(ROOT, 'workspace', 'vendor_knowledge');
const MANIFEST_PATH = path.join(ROOT, 'knowledge_base', 'manifests', 'document_manifest.json');

let ALLOWED_VENDOR_DOMAINS = [
  'st.com',
  'nxp.com',
  'amd.com',
  'xilinx.com',
  'digilent.com',
  'files.digilent.com',
  'ti.com',
  'nvidia.com',
  'developer.nvidia.com',
  'docs.nvidia.com',
  'raspberrypi.com',
  'datasheets.raspberrypi.com',
];

function isOfficialUrl(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    return ALLOWED_VENDOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isPdfBuffer(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function downloadDocument(doc) {
  if (doc.status === 'NOT_PUBLICLY_AVAILABLE') {
    return {
      vendor: doc.vendor,
      board: doc.board,
      document_type: doc.document_type,
      title: doc.title,
      official_url: doc.official_url,
      local_path: '',
      sha256: '',
      size_bytes: 0,
      downloaded_at: new Date().toISOString(),
      status: 'NOT_PUBLICLY_AVAILABLE',
      note: doc.note || 'Document not publicly published by vendor.'
    };
  }

  if (!isOfficialUrl(doc.official_url)) {
    return {
      vendor: doc.vendor,
      board: doc.board,
      document_type: doc.document_type,
      title: doc.title,
      official_url: doc.official_url,
      local_path: '',
      sha256: '',
      size_bytes: 0,
      downloaded_at: new Date().toISOString(),
      status: 'rejected_non_official_domain'
    };
  }

  const localPath = path.join(VENDOR_KNOWLEDGE_ROOT, doc.relative_path);
  const targetDir = path.dirname(localPath);
  await fs.mkdir(targetDir, { recursive: true });

  // Check if file already exists & is valid
  try {
    const existing = await fs.readFile(localPath);
    if (isPdfBuffer(existing)) {
      return {
        vendor: doc.vendor,
        board: doc.board,
        document_type: doc.document_type,
        title: doc.title,
        official_url: doc.official_url,
        local_path: path.relative(ROOT, localPath).replaceAll('\\', '/'),
        sha256: sha256(existing),
        size_bytes: existing.length,
        downloaded_at: new Date().toISOString(),
        status: 'downloaded'
      };
    }
  } catch {
    // File doesn't exist yet, proceed with download
  }

  try {
    const response = await fetch(doc.official_url, {
      redirect: 'follow',
      headers: { 'user-agent': 'BSP-Astra-KnowledgeBase/1.0' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

    const finalUrl = response.url;
    if (!isOfficialUrl(finalUrl)) {
      throw new Error(`Redirected to non-official domain: ${finalUrl}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('Empty response');

    if (!isPdfBuffer(buffer)) {
      const headSnippet = buffer.subarray(0, 100).toString('utf8');
      throw new Error(`Expected PDF (%PDF-) but received non-PDF signature: ${headSnippet.slice(0, 30)}...`);
    }

    await fs.writeFile(localPath, buffer);

    return {
      vendor: doc.vendor,
      board: doc.board,
      document_type: doc.document_type,
      title: doc.title,
      official_url: doc.official_url,
      local_path: path.relative(ROOT, localPath).replaceAll('\\', '/'),
      sha256: sha256(buffer),
      size_bytes: buffer.length,
      downloaded_at: new Date().toISOString(),
      status: 'downloaded'
    };
  } catch (error) {
    return {
      vendor: doc.vendor,
      board: doc.board,
      document_type: doc.document_type,
      title: doc.title,
      official_url: doc.official_url,
      local_path: path.relative(ROOT, localPath).replaceAll('\\', '/'),
      sha256: '',
      size_bytes: 0,
      downloaded_at: new Date().toISOString(),
      status: 'failed',
      error: String(error?.message || error)
    };
  }
}

async function main() {
  const catalogData = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  console.log(`[KnowledgeBase Downloader] Processing ${catalogData.documents.length} official document entries...`);

  const manifestEntries = [];
  for (let i = 0; i < catalogData.documents.length; i++) {
    const doc = catalogData.documents[i];
    process.stdout.write(`[${i + 1}/${catalogData.documents.length}] ${doc.board} - ${doc.document_type}: ${doc.title} ... `);
    const result = await downloadDocument(doc);
    manifestEntries.push(result);
    if (result.status === 'downloaded') {
      console.log(`OK (${result.size_bytes} bytes) -> ${result.local_path}`);
    } else {
      console.log(`FAILED: ${result.error || result.status}`);
    }
  }

  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifestEntries, null, 2));
  console.log(`\nUpdated manifest: ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch(err => {
  console.error("Downloader failed:", err);
  process.exit(1);
});

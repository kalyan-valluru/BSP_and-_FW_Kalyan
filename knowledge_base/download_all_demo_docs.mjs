import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'backend', 'data', 'official_hardware_sources.json');
const RAW_ROOT = path.join(ROOT, 'workspace', 'vendor_knowledge', 'raw');
const STATUS_PATH = path.join(ROOT, 'workspace', 'vendor_knowledge', 'download_status.json');

const ALLOWED_VENDOR_DOMAINS = [
  'st.com',
  'nxp.com',
  'amd.com',
  'xilinx.com',
  'ti.com',
  'nvidia.com',
  'raspberrypi.com',
];

function isOfficial(urlString) {
  const host = new URL(urlString).hostname.toLowerCase();
  return ALLOWED_VENDOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 140);
}

function vendorDir(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function isPdfBuffer(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function looksLikeHtml(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trim().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<head') || head.includes('<body');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function preferredExtension(document, contentType, buffer) {
  if (isPdfBuffer(buffer)) return '.pdf';
  if ((contentType || '').toLowerCase().includes('html') || looksLikeHtml(buffer)) return '.html';
  const pathname = new URL(document.url).pathname.toLowerCase();
  if (pathname.endsWith('.pdf')) return '.pdf';
  return '.bin';
}

async function downloadDocument(document) {
  if (!isOfficial(document.url)) {
    return { ...document, status: 'REJECTED_NON_OFFICIAL' };
  }

  const targetDir = path.join(RAW_ROOT, vendorDir(document.vendor), safeName(document.product));
  await fs.mkdir(targetDir, { recursive: true });

  try {
    const response = await fetch(document.url, {
      redirect: 'follow',
      headers: { 'user-agent': 'BSP-Astra-KnowledgeBase/1.0' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    if (!isOfficial(response.url)) throw new Error(`Redirected outside official vendor domain: ${response.url}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('Empty response');

    const contentType = response.headers.get('content-type') || '';
    const extension = preferredExtension(document, contentType, buffer);

    // If the manifest describes a PDF-like document, never silently save an HTML login/error page as .pdf.
    const pdfExpected = /pdf$/i.test(new URL(document.url).pathname) || /datasheet|reference manual|user manual|errata|technical reference manual/i.test(document.type);
    if (pdfExpected && !isPdfBuffer(buffer)) {
      throw new Error(`Expected PDF but received ${contentType || 'unknown content type'} from ${response.url}`);
    }

    const filePath = path.join(targetDir, `${safeName(document.title)}${extension}`);
    await fs.writeFile(filePath, buffer);

    return {
      ...document,
      status: 'DOWNLOADED',
      localPath: path.relative(ROOT, filePath).replaceAll('\\', '/'),
      sha256: sha256(buffer),
      bytes: buffer.length,
      contentType,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      ...document,
      status: 'PENDING_RUNTIME_DOWNLOAD',
      error: String(error?.message || error),
    };
  }
}

const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
await fs.mkdir(RAW_ROOT, { recursive: true });

console.log(`Official documentation manifest: ${manifest.documents.length} documents`);
console.log(`Destination: ${path.relative(ROOT, RAW_ROOT)}\n`);

const results = [];
for (let i = 0; i < manifest.documents.length; i += 1) {
  const document = manifest.documents[i];
  process.stdout.write(`[${i + 1}/${manifest.documents.length}] ${document.vendor} - ${document.title} ... `);
  const result = await downloadDocument(document);
  results.push(result);
  console.log(result.status === 'DOWNLOADED' ? `OK (${result.localPath})` : `${result.status}${result.error ? `: ${result.error}` : ''}`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  policy: 'OFFICIAL_VENDOR_ONLY',
  total: results.length,
  downloaded: results.filter((item) => item.status === 'DOWNLOADED').length,
  pending: results.filter((item) => item.status === 'PENDING_RUNTIME_DOWNLOAD').length,
  rejected: results.filter((item) => item.status === 'REJECTED_NON_OFFICIAL').length,
  documents: results,
};

await fs.mkdir(path.dirname(STATUS_PATH), { recursive: true });
await fs.writeFile(STATUS_PATH, JSON.stringify(summary, null, 2));

console.log('\nDone.');
console.log(`Downloaded: ${summary.downloaded}/${summary.total}`);
console.log(`Pending:    ${summary.pending}`);
console.log(`Rejected:   ${summary.rejected}`);
console.log(`Status:     ${path.relative(ROOT, STATUS_PATH)}`);
console.log(`Documents:  ${path.relative(ROOT, RAW_ROOT)}`);

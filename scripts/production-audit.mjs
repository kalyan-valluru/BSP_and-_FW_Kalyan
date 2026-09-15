import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const excludedDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);
const excludedFiles = new Set(['scripts/production-audit.mjs', 'scripts/harden-legacy3.mjs', 'scripts/fix-index-syntax.mjs']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py']);

const forbidden = [
  { name: 'fabricated Raspberry Pi DTB fallback', pattern: /raspberrypi,4-compute-module|brcm,bcm2711/i },
  { name: 'fake DTB byte construction', pattern: /Buffer\.from\(\[0xd0\s*,\s*0x0d\s*,\s*0xfe\s*,\s*0xed/i },
  { name: 'hardcoded FPGA part fallback', pattern: /xc7z020clg484-1|xc7z020clg400-1|xczu9eg-ffvb1156-2-i|xczu3eg-sbva484-1-e/i },
  { name: 'hardcoded clock fallback', pattern: /FCLK0=100MHz/i },
  { name: 'hardcoded memory fallback', pattern: /4GB DDR4|512MB/i },
  { name: 'mock firmware artifact path', pattern: /\/mock\/firmware\.elf|mock\\firmware\.elf/i },
  { name: 'hardcoded private service endpoint', pattern: /13\.233\.63\.82:3002/i },
  { name: 'fabricated vendor register evidence', pattern: /Verified Official Vendor Register Map/i },
  { name: 'hardcoded readiness metric', pattern: /vkr_readiness_score\s+97\.2/i },
  { name: 'hardcoded peripheral metric', pattern: /vkr_peripherals_indexed\s+184/i },
  { name: 'hardcoded TI Sitara register map', pattern: /AM335X_(UART0|GPIO1|I2C1|SPI0)_BASE/i },
];

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) out.push(...await walk(path.join(dir, entry.name)));
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) out.push(path.join(dir, entry.name));
  }
  return out;
}

const files = await walk(root);
const findings = [];
for (const file of files) {
  if (excludedFiles.has(path.relative(root, file).replaceAll('\\', '/'))) continue;
  const lines = (await fs.readFile(file, 'utf8')).split(/\r?\n/);
  for (const rule of forbidden) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) findings.push({ file: path.relative(root, file), line: i + 1, rule: rule.name, text: lines[i].trim() });
    }
  }
}
if (findings.length) {
  console.error(`Production audit failed: ${findings.length} forbidden/fabricated patterns found.`);
  for (const f of findings) console.error(`- ${f.file}:${f.line} | ${f.rule} | ${f.text}`);
  process.exit(1);
}
console.log(`Production audit passed: scanned ${files.length} source files with no forbidden fabrication/default patterns.`);

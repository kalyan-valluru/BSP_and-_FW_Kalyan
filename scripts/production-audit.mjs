import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const excludedDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);
const excludedFiles = new Set(['scripts/production-audit.mjs', 'scripts/harden-legacy3.mjs', 'scripts/harden-spec.mjs', 'scripts/fix-index-syntax.mjs']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py']);

const forbidden = [
  { name: 'fabricated Raspberry Pi DTB fallback', pattern: /raspberrypi,4-compute-module|brcm,bcm2711/i },
  { name: 'fake DTB byte construction', pattern: /Buffer\.from\(\[0xd0\s*,\s*0x0d\s*,\s*0xfe\s*,\s*0xed/i },
  { name: 'hardcoded FPGA part fallback', pattern: /xc7z020clg484-1|xc7z020clg400-1|xczu9eg-ffvb1156-2-i|xczu3eg-sbva484-1-e/i },
  { name: 'hardcoded clock fallback', pattern: /FCLK0\s*=\s*100\s*MHz|clockFrequency\s*:\s*['"]?100\s*MHz/i },
  { name: 'hardcoded memory fallback', pattern: /4GB DDR4|512MB/i },
  { name: 'mock or placeholder firmware artifact', pattern: /FIRMWARE_BINARY_PLACEHOLDER|FIRMWARE_.*PLACEHOLDER|firmware.*placeholder|mock.*firmware|binary.*placeholder/i },
  { name: 'mock Linux device-tree artifact', pattern: /Mock Linux Device Tree|mock.*device tree/i },
  { name: 'hardcoded private service endpoint', pattern: /13\.233\.63\.82:3002/i },
  { name: 'fabricated vendor register evidence', pattern: /Verified Official Vendor Register Map/i },
  { name: 'hardcoded readiness metric', pattern: /vkr_readiness_score\s+(?:97\.2|\d+(?:\.\d+)?)/i },
  { name: 'hardcoded peripheral metric', pattern: /vkr_peripherals_indexed\s+(?:184|\d+)/i },
  { name: 'hardcoded TI Sitara register map', pattern: /AM335X_(UART0|GPIO1|I2C1|SPI0)_BASE/i },
  { name: 'hardcoded architecture fallback', pattern: /['"]ARM Cortex-A9['"]|['"]Spec Board['"]|['"]Generic Hardware['"]|['"]Unknown Board['"]|['"]ARM['"]\s*[:;]/i },
  { name: 'host compiler fallback for target firmware', pattern: /GCC_PATH.*arm-none-eabi-gcc|gccAarch32.*\|\|\s*['"]arm-none-eabi-gcc['"]|\|\|\s*['"]gcc['"]\s*;/i },
  { name: 'hardcoded network target fallback', pattern: /192\.168\.1\.50|@pi\b/i },
  { name: 'unconditional successful HIL response', pattern: /res\.json\(\{\s*success:\s*true,\s*result\s*\}\)/i },
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

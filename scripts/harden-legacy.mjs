import fs from 'node:fs/promises';

const replacements = [
  ['backend/server/executionOrchestrator.ts', async text => {
    text = text.replace(/export const TI_SITARA_DEFAULT_C_CODE = `<!--[\\s\\S]*?`;\n\n(?=\/\/ Register all multi-platform strategies)/, '');
    text = text.replace(/export const TI_SITARA_DEFAULT_C_CODE = `<!--[\\s\\S]*?`;\n\n(?=\/\/ Register all multi-platform strategies)/, '');
    text = text.replace(/export const TI_SITARA_DEFAULT_C_CODE = `([\\s\\S]*?)`;\n\n(?=\/\/ Register all multi-platform strategies)/, '');
    text = text.replace(/\/\/ Auto-resolve canonical FPGA device part based on target processor family[\\s\\S]*?\n\n  \/\/ Strict Input Boundary Enforcement/, `const canonicalFpgaPart = String(\n    baseMeta.fpgaDevice || baseMeta.fpgaPart || hklObj?.fpgaDevice || hklObj?.fpgaPart || ''\n  ).trim();\n\n  if (hklObj && canonicalFpgaPart) {\n    hklObj.fpgaDevice = canonicalFpgaPart;\n    hklObj.fpgaPart = canonicalFpgaPart;\n  }\n\n  // Strict Input Boundary Enforcement`);
    text = text.replace(/fpgaDevice: canonicalFpgaPart,\n    fpgaPart: canonicalFpgaPart,/g, `fpgaDevice: canonicalFpgaPart || undefined,\n    fpgaPart: canonicalFpgaPart || undefined,`);
    text = text.replace(/clockSources: baseMeta\.clockSources \|\| hklObj\?\.clockSources \|\| \['FCLK0=100MHz'\],/g, `clockSources: baseMeta.clockSources || hklObj?.clockSources || [],`);
    text = text.replace(/memorySize: baseMeta\.memorySize \|\| hklObj\?\.memory \|\| \(isUltraScaleTarget \? '4GB DDR4' : '512MB'\),/g, `memorySize: baseMeta.memorySize || hklObj?.memory || '',`);
    text = text.replace(/interruptController: baseMeta\.interruptController \|\| hklObj\?\.interruptController \|\| 'axi_intc_0',/g, `interruptController: baseMeta.interruptController || hklObj?.interruptController || '',`);
    text = text.replace(/hklStatus: baseMeta\.hklStatus \|\| hklObj\?\.hklStatus \|\| 'READY',/g, `hklStatus: baseMeta.hklStatus || hklObj?.hklStatus || 'UNVERIFIED',`);
    text = text.replace(/\n\s*\/\/ Auto-promote HKL status to READY for execution\n\s*metadata\.hklStatus = 'READY';\n\s*if \(metadata\.hkl\) \{\n\s*metadata\.hkl\.hklStatus = 'READY';\n\s*\}/, '');
    text = text.replace(/const vendor = metadata\.vendor \|\| [^;]+;/, `const vendor = String(metadata.vendor || '').trim();\n  if (!vendor) { return { success: false, error: 'Verified vendor identity is required before execution.' }; }`);
    return text;
  }],
  ['server/index.ts', async text => {
    text = text.replace("app.use(cors());", `const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);\napp.use(cors({ origin: configuredOrigins.length ? configuredOrigins : false, credentials: true }));`);
    text = text.replace(/app\.get\('\/readiness',[\s\S]*?\n\}\);\n\napp\.get\('\/version'/, `app.get('/readiness', async (_req: Request, res: Response) => {\n  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);\n  const ready = hasGeminiKey;\n  res.status(ready ? 200 : 503).json({ status: ready ? 'READY' : 'NOT_READY', aiProviderConfigured: hasGeminiKey, uptimeSeconds: process.uptime() });\n});\n\napp.get('/version'`);
    text = text.replace(/vkr_peripherals_indexed 184/g, `vkr_peripherals_indexed ${Number.isFinite((globalThis).vkrPeripheralsIndexed) ? (globalThis).vkrPeripheralsIndexed : 0}`);
    text = text.replace(/vkr_readiness_score 97\.2/g, `vkr_readiness_score 0`);
    text = text.replace(/const fastRes = await fetch\('http:\/\/13\.233\.63\.82:3002\/api\/support\/packages'\);[\s\S]*?\n\s*\} catch \(_err\) \{[\s\S]*?\n\s*\}/g, '');
    text = text.replace(/processorName \|\| 'ARM Core'/g, `processorName || ''`);
    text = text.replace(/processor \|\| processorName \|\| 'ARM Core'/g, `processor || processorName || ''`);
    text = text.replace(/board \|\| 'ZedBoard'/g, `board || ''`);
    text = text.replace(/binaryPath \|\| '\/mock\/firmware\.elf'/g, `binaryPath || ''`);
    text = text.replace(/allowSimulatedFallbacks: true/g, `allowSimulatedFallbacks: false`);
    text = text.replace(/hasBitstream: true,\n\s*hasXsa: true,\n\s*hasBsp: true,\n\s*hasElf: true,/g, `hasBitstream: Boolean(req.body.bitstreamPath && fsSync.existsSync(req.body.bitstreamPath)),\n        hasXsa: Boolean(req.body.xsaPath && fsSync.existsSync(req.body.xsaPath)),\n        hasBsp: Boolean(req.body.bspPath && fsSync.existsSync(req.body.bspPath)),\n        hasElf: Boolean(req.body.elfPath && fsSync.existsSync(req.body.elfPath)),`);
    return text;
  }]
];

for (const [file, transform] of replacements) {
  const original = await fs.readFile(file, 'utf8');
  const updated = await transform(original);
  if (updated !== original) {
    await fs.writeFile(file, updated, 'utf8');
    console.log(`Hardened ${file}`);
  } else {
    console.log(`No changes needed in ${file}`);
  }
}

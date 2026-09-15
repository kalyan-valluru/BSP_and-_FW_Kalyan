import fs from 'node:fs/promises';

const replacements = [
  ['backend/server/executionOrchestrator.ts', async text => {
    const tiStart = text.indexOf('export const TI_SITARA_DEFAULT_C_CODE = `');
    const tiEnd = text.indexOf('// Register all multi-platform strategies', tiStart);
    if (tiStart >= 0 && tiEnd > tiStart) text = text.slice(0, tiStart) + text.slice(tiEnd);

    const fpgaStart = text.indexOf('// Auto-resolve canonical FPGA device part based on target processor family');
    const fpgaEnd = text.indexOf('// Strict Input Boundary Enforcement', fpgaStart);
    if (fpgaStart >= 0 && fpgaEnd > fpgaStart) {
      text = text.slice(0, fpgaStart) + `const canonicalFpgaPart = String(\n    baseMeta.fpgaDevice || baseMeta.fpgaPart || hklObj?.fpgaDevice || hklObj?.fpgaPart || ''\n  ).trim();\n\n  if (hklObj && canonicalFpgaPart) {\n    hklObj.fpgaDevice = canonicalFpgaPart;\n    hklObj.fpgaPart = canonicalFpgaPart;\n  }\n\n  ` + text.slice(fpgaEnd);
    }

    text = text.replace(/fpgaDevice: canonicalFpgaPart,\n\s*fpgaPart: canonicalFpgaPart,/g, `fpgaDevice: canonicalFpgaPart || undefined,\n    fpgaPart: canonicalFpgaPart || undefined,`);
    text = text.replace(/clockSources: baseMeta\.clockSources \|\| hklObj\?\.clockSources \|\| \['FCLK0=100MHz'\],/g, `clockSources: baseMeta.clockSources || hklObj?.clockSources || [],`);
    text = text.replace(/memorySize: baseMeta\.memorySize \|\| hklObj\?\.memory \|\| \(isUltraScaleTarget \? '4GB DDR4' : '512MB'\),/g, `memorySize: baseMeta.memorySize || hklObj?.memory || '',`);
    text = text.replace(/interruptController: baseMeta\.interruptController \|\| hklObj\?\.interruptController \|\| 'axi_intc_0',/g, `interruptController: baseMeta.interruptController || hklObj?.interruptController || '',`);
    text = text.replace(/hklStatus: baseMeta\.hklStatus \|\| hklObj\?\.hklStatus \|\| 'READY',/g, `hklStatus: baseMeta.hklStatus || hklObj?.hklStatus || 'UNVERIFIED',`);
    text = text.replace(/\n\s*\/\/ Auto-promote HKL status to READY for execution\n\s*metadata\.hklStatus = 'READY';\n\s*if \(metadata\.hkl\) \{\n\s*metadata\.hkl\.hklStatus = 'READY';\n\s*\}/, '');
    text = text.replace(/const vendor = metadata\.vendor \|\| [^;]+;/, `const vendor = String(metadata.vendor || '').trim();\n  if (!vendor) { return { success: false, error: 'Verified vendor identity is required before execution.' }; }`);
    text = text.replace(/const processor = metadata\.processorName \|\| [^;]+;/, `const processor = String(metadata.processorName || '').trim();\n  if (!processor) { return { success: false, error: 'Verified processor identity is required before execution.' }; }`);
    text = text.replace(/const pLower = safePresetId\.toLowerCase\(\);/, `const pLower = safePresetId.toLowerCase();`);
    return text;
  }],
  ['server/index.ts', async text => {
    text = text.replace("app.use(cors());", `const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);\napp.use(cors({ origin: configuredOrigins.length ? configuredOrigins : false, credentials: true }));`);
    text = text.replace(/app\.get\('\/readiness',[\s\S]*?\n\}\);\n\napp\.get\('\/version'/, `app.get('/readiness', async (_req: Request, res: Response) => {\n  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);\n  const ready = hasGeminiKey;\n  res.status(ready ? 200 : 503).json({ status: ready ? 'READY' : 'NOT_READY', aiProviderConfigured: hasGeminiKey, uptimeSeconds: process.uptime() });\n});\n\napp.get('/version'`);
    text = text.replace(/vkr_peripherals_indexed 184/g, `vkr_peripherals_indexed 0`);
    text = text.replace(/vkr_readiness_score 97\.2/g, `vkr_readiness_score 0`);
    text = text.replace(/const fastRes = await fetch\('http:\/\/13\.233\.63\.82:3002\/api\/support\/packages'\);[\s\S]*?\n\s*\} catch \(_err\) \{[\s\S]*?\n\s*\}/g, '');
    text = text.replace(/processorName \|\| 'ARM Core'/g, `processorName || ''`);
    text = text.replace(/processor \|\| processorName \|\| 'ARM Core'/g, `processor || processorName || ''`);
    text = text.replace(/board \|\| 'ZedBoard'/g, `board || ''`);
    text = text.replace(/binaryPath \|\| '\/mock\/firmware\.elf'/g, `binaryPath || ''`);
    text = text.replace(/allowSimulatedFallbacks: true/g, `allowSimulatedFallbacks: false`);
    text = text.replace(/hasBitstream: true,\n\s*hasXsa: true,\n\s*hasBsp: true,\n\s*hasElf: true,/g, `hasBitstream: Boolean(req.body.bitstreamPath && fsSync.existsSync(req.body.bitstreamPath)),\n        hasXsa: Boolean(req.body.xsaPath && fsSync.existsSync(req.body.xsaPath)),\n        hasBsp: Boolean(req.body.bspPath && fsSync.existsSync(req.body.bspPath)),\n        hasElf: Boolean(req.body.elfPath && fsSync.existsSync(req.body.elfPath)),`);

    const universalMarker = '    // Ensure system.dts and main.c exist for non-FPGA preset validation';
    const universalEnd = text.indexOf('    const report = await universalEngine.executeValidation', text.indexOf(universalMarker));
    if (universalMarker && universalEnd > 0) {
      const start = text.indexOf(universalMarker);
      const replacement = `    // Validation consumes only artifacts that already exist; this endpoint never manufactures inputs.\n    const dtsPath = path.join(workspaceDir, 'system.dts');\n    const mainPath = path.join(workspaceDir, 'main.c');\n    const elfPath = path.join(workspaceDir, 'firmware.elf');\n\n`;
      text = text.slice(0, start) + replacement + text.slice(universalEnd);
    }

    text = text.replace(/platformId: platformId \|\| platformName \|\| 'generic-non-fpga'/g, `platformId`);
    text = text.replace(/platformName: platformName \|\| platformId \|\| 'Generic Non-FPGA Board'/g, `platformName`);
    text = text.replace(/vendor: vendor \|\| 'ARM \/ Multi-Vendor'/g, `vendor`);
    text = text.replace(/architecture: architecture \|\| 'ARM'/g, `architecture`);
    text = text.replace(/targetFlow: targetFlow \|\| 'both'/g, `targetFlow`);
    text = text.replace(/sessionId: sessionId \|\| `sess_\$\{Date\.now\(\)\}`/g, `sessionId`);
    text = text.replace(/boardName \|\| 'Target Board'/g, `boardName || ''`);
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

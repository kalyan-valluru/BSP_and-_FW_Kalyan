import fs from 'node:fs/promises';
const file = 'backend/server/executionOrchestrator.ts';
let text = await fs.readFile(file, 'utf8');
const replacements = [
  ["const architecture = pidStr.includes('microblaze') ? 'MicroBlaze' : pidStr.includes('stm32') ? 'STM32' : 'ARM Cortex-A9';", "const architecture = String(metadata.architecture || metadata.processorName || '').trim();\n    if (!architecture) throw new Error('Specification analysis requires verified processor and architecture data.');"],
  ["boardName: presetId || 'Spec Board',", "boardName: metadata.boardName || presetId || '',"],
  ["architecture: pidStr.includes('microblaze') ? 'MicroBlaze' : 'ARM',", "architecture: metadata.architecture || '',"],
  ["const compiler = process.env.GCC_PATH || TOOL_PATHS.gccAarch32 || 'arm-none-eabi-gcc';", "const compiler = process.env.GCC_PATH || (TOOL_PATHS as any).gccAarch32 || '';\n      if (!compiler) throw new Error('No configured cross-compiler is available for this target.');"],
  ["if (code === 0) resolve({ success: true });\n          else {", "if (code === 0) resolve({ success: true });\n          else {\n            resolve({ success: false, error: `Cross-compiler exited with code ${code}: ${errStr}` });\n            return;"],
  ["onLog('warning', `[COMPILER SKIPPED] Target cross-compiler toolchain unavailable (${compRes.error}). Emitting validated C source & binary placeholder.`);\n        await fs.writeFile(firmwareElfPath, Buffer.from('FIRMWARE_BINARY_PLACEHOLDER'));", "onLog('error', `[COMPILER FAILURE] Target cross-compiler unavailable: ${compRes.error}`);\n        return { success: false, error: compRes.error };"],
  ["await fs.writeFile(finalResultPath, deviceTreeCode || '/* Mock Linux Device Tree */');", "if (!deviceTreeCode?.trim()) throw new Error('Linux workflow requires validated Device Tree source or a real generated DTS artifact.');\n      await fs.writeFile(finalResultPath, deviceTreeCode);"],
  ["processor: metadata.processorName || presetId,", "processor: metadata.processorName || '',"],
  ["board: metadata.boardName || presetId,", "board: metadata.boardName || '',"]
];
for (const [from, to] of replacements) text = text.split(from).join(to);
await fs.writeFile(file, text, 'utf8');

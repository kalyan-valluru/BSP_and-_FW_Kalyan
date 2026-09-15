import fs from 'node:fs/promises';

for (const file of ['backend/server/executionOrchestrator.ts', 'server/index.ts']) {
  let text = await fs.readFile(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  text = text.replace(/\r\n/g, '\n');
  const original = text;
  text = text.replace("detectBoardConfig(metadata.processorName || presetId || 'Zynq', metadata.architecture)", "detectBoardConfig(metadata.processorName || presetId, metadata.architecture)");
  text = text.replace("metadata.fpgaDevice || 'xc7z020'", "metadata.fpgaDevice || metadata.fpgaPart || ''");
  text = text.replace("metadata.architecture || 'ARM'", "metadata.architecture || ''");
  text = text.replace(/\n\s*if \(process\.platform === 'win32'\) \{[\s\S]*?\n\s*\}/, '');
  text = text.replace("boardName || 'Target Board'", "boardName || ''");
  if (text !== original) await fs.writeFile(file, text.replace(/\n/g, eol), 'utf8');
}

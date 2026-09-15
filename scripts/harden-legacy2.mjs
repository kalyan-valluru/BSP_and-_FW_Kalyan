import fs from 'node:fs/promises';

const files = ['backend/server/executionOrchestrator.ts', 'server/index.ts'];
for (const file of files) {
  let text = await fs.readFile(file, 'utf8');
  text = text.replace(/detectBoardConfig\(metadata\.processorName \|\| presetId \|\| 'Zynq', metadata\.architecture\)/g, 'detectBoardConfig(metadata.processorName || presetId, metadata.architecture)');
  text = text.replace(/metadata\.fpgaDevice \|\| 'xc7z020'/g, "metadata.fpgaDevice || metadata.fpgaPart || ''");
  text = text.replace(/metadata\.architecture \|\| 'ARM'/g, "metadata.architecture || ''");
  text = text.replace(/\n\s*if \(process\.platform === 'win32'\) \{\n\s*workspace = path\.join\('C:\\\\', 'temp_bsp', sessionId\);\n\s*\}/g, '');
  text = text.replace(/boardName \|\| 'Target Board'/g, "boardName || ''");
  await fs.writeFile(file, text, 'utf8');
  console.log(`normalized ${file}`);
}

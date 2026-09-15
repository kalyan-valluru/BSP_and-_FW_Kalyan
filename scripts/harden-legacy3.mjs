import fs from 'node:fs/promises';

for (const file of ['backend/server/executionOrchestrator.ts', 'server/index.ts']) {
  let text = await fs.readFile(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  text = text.replace(/\r\n/g, '\n');
  const original = text;

  const replacements = [
    ["detectBoardConfig(metadata.processorName || presetId || 'Zynq', metadata.architecture)", "detectBoardConfig(metadata.processorName || presetId, metadata.architecture)"],
    ["metadata.fpgaDevice || 'xc7z020'", "metadata.fpgaDevice || metadata.fpgaPart || ''"],
    ["metadata.architecture || 'ARM'", "metadata.architecture || ''"],
    ["boardName || 'Target Board'", "boardName || ''"],
    ["const procNameVal = ctx.state.procName || 'ps7_cortexa9_0';", "const procNameVal = ctx.state.procName || metadata.processorName || '';\n    if (!procNameVal) throw new Error('Verified processor identity is required for artifact collection.');"],
    ["const isZynq7000Val = ctx.state.isZynq7000 !== false;", "const isZynq7000Val = ctx.state.isZynq7000 === true;"],
    ["architecture: metadata.architecture || 'ARM Cortex-A9',", "architecture: metadata.architecture || caps.architecture || '',"],
    ["const architecture = pid.includes('microblaze') ? 'MicroBlaze' : (pid.includes('stm32') ? 'STM32' : (pid.includes('raspberry') || pid.includes('cm4') || pid.includes('bcm2711') ? 'ARM Cortex-A72 (BCM2711)' : (metadata.processorName || 'ARM Cortex-A9')));", "const architecture = String(metadata.architecture || metadata.processorName || '').trim();\n    if (!architecture) throw new Error('Hardware understanding requires verified processor and architecture data.');"],
    ["boardName: presetId || 'AI Board',", "boardName: metadata.boardName || presetId || '',"],
    ["architecture: (presetId || '').toLowerCase().includes('microblaze') ? 'MicroBlaze' : 'ARM',", "architecture: metadata.architecture || halDevice.architecture || '',"],
    ["driverName: p.driverName || 'N/A',", "driverName: p.driverName || '',"],
    ["clockSource: p.clockSource || 'FCLK0',", "clockSource: p.clockSource || '',"],
    ["clockFrequency: p.clockFrequency || '100 MHz'", "clockFrequency: p.clockFrequency || ''"],
    ["clock: '100MHz',", "clock: metadata.clockFrequency || '',"],
    ["clockFrequency: '100MHz',", "clockFrequency: metadata.clockFrequency || '',"]
  ];

  for (const [from, to] of replacements) text = text.split(from).join(to);
  text = text.replace(/\n\s*if \(process\.platform === 'win32'\) \{[\s\S]*?\n\s*\}/, '');

  if (text !== original) await fs.writeFile(file, text.replace(/\n/g, eol), 'utf8');
}

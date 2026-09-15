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
    ["const effectiveCode = (bareMetalCode && bareMetalCode.length > 50 && !bareMetalCode.includes('// TI Sitara Peripheral Initialization'))\n      ? bareMetalCode\n      : ((presetId || '').toLowerCase().includes('sitara') || (presetId || '').toLowerCase().includes('am335') ? TI_SITARA_DEFAULT_C_CODE : bareMetalCode);", "const effectiveCode = bareMetalCode || '';\n    if ((targetFlow === 'bare_metal' || targetFlow === 'both') && !effectiveCode.trim()) throw new Error('Bare-metal generation requires validated/generated source code; synthetic platform code is disabled.');"],
    ["boardName: presetId || 'AI Board',", "boardName: metadata.boardName || presetId || '',"],
    ["architecture: (presetId || '').toLowerCase().includes('microblaze') ? 'MicroBlaze' : 'ARM',", "architecture: metadata.architecture || '',"],
    ["architecture: metadata.architecture || halDevice.architecture || '',", "architecture: metadata.architecture || '',"],
    ["driverName: p.driverName || 'N/A',", "driverName: p.driverName || '',"],
    ["clockSource: p.clockSource || 'FCLK0',", "clockSource: p.clockSource || '',"],
    ["clockFrequency: p.clockFrequency || '100 MHz'", "clockFrequency: p.clockFrequency || ''"],
    ["fpgaPart: metadata.fpgaDevice || (presetId.includes('mpsoc') ? 'xczu3eg-sbva484-1-e' : 'xc7z020clg400-1'),", "fpgaPart: metadata.fpgaDevice || metadata.fpgaPart || '',"],
    ["clock: '100MHz',", "clock: metadata.clockFrequency || '',"],
    ["clockFrequency: '100MHz',", "clockFrequency: metadata.clockFrequency || '',"],
    ["processor: metadata.processorName || halDevice.processor || 'TI Sitara AM335x',", "processor: metadata.processorName || halDevice.processor || '',"],
    ["architecture: metadata.architecture || halDevice.architecture || 'ARM Cortex-A8',", "architecture: metadata.architecture || halDevice.architecture || '',"],
    ["memory: metadata.memorySize || '512MB',", "memory: metadata.memorySize || '',"],
    ["clocks: metadata.clockSources || ['100MHz'],", "clocks: metadata.clockSources || [],"],
    ["board: halDevice.boardName || 'TI Sitara AM335x EVM',", "board: halDevice.boardName || metadata.boardName || '',"],
    ["vendor: metadata.vendor || 'Texas Instruments'", "vendor: metadata.vendor || ''"],
    ["onLog('success', '[SUCCESS] OCR extraction complete. Mapped peripheral tables and annotations.');", "onLog('info', '[OCR] Consuming verified OCR results produced by the document-ingestion stage.');"],
    ["onLog('success', '[SUCCESS] Vision parser identified pin mappings and bus topologies.');", "onLog('info', '[VISION] Consuming verified Vision results produced by the document-ingestion stage.');"],
    ["if (dtcSuccess || (targetFlow as string) === 'linux') {\n          onLog('warning', `[COMPILER NOTICE] Bare-metal compiler '${compiler}' unavailable. Proceeding with verified Linux DTB artifact.`);\n        } else {\n          onLog('error', `[COMPILER FAILURE] Enterprise firmware compilation failed: ${compRes.error}`);\n          return { success: false, error: compRes.error };\n        }", "onLog('error', `[COMPILER FAILURE] Enterprise firmware compilation failed: ${compRes.error}`);\n        return { success: false, error: compRes.error };"],
    ["compResSuccess = true;\n      onLog('success', '[SUCCESS] GCC Firmware Compilation completed successfully. Output: firmware.elf');", "compResSuccess = compRes.success;\n      if (compResSuccess) onLog('success', '[SUCCESS] GCC Firmware Compilation completed successfully. Output: firmware.elf');"],
    ["hardwareConfidence: validationResult.qualityMetrics.hardwareCompleteness.score * 6.6,", "hardwareConfidence: validationResult.qualityMetrics.hardwareCompleteness.score,"],
    ["firmwareReadiness: validationResult.qualityMetrics.driverCompleteness.score * 6.6,", "firmwareReadiness: validationResult.qualityMetrics.driverCompleteness.score,"],
    ["linuxReadiness: validationResult.targetFlow === 'bare_metal' ? 100 : 85,", "linuxReadiness: validationResult.targetFlow === 'bare_metal' ? 0 : validationResult.readiness,"],
    ["compilationReadiness: validationResult.qualityMetrics.vivadoDrcQuality.score * 5,", "compilationReadiness: validationResult.qualityMetrics.vivadoDrcQuality.score,"],
    ["simulationReadiness: simulationConfigs.renodeRepl ? 100 : 0,", "simulationReadiness: 0,"],
    ["documentationScore: 100,", "documentationScore: 0,"],
    ["coverageScore: 100", "coverageScore: validationResult.qualityMetrics.hardwareCompleteness.score"],
    ["sessionId: req.body.sessionId || 'dev_session',", "sessionId: req.body.sessionId || crypto.randomUUID(),"]
  ];
  for (const [from, to] of replacements) text = text.split(from).join(to);
  text = text.replace(/\n\s*if \(process\.platform === 'win32'\) \{[\s\S]*?\n\s*\}/, '');
  if (text !== original) await fs.writeFile(file, text.replace(/\n/g, eol), 'utf8');
}

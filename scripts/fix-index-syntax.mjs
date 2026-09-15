import fs from 'node:fs/promises';

const file = 'server/index.ts';
let text = await fs.readFile(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
text = text.replace(/\r\n/g, '\n');

const start1 = text.indexOf("// API: Get all hardware presets");
const end1 = text.indexOf("// Session-scoped HardwareModelStore map", start1);
if (start1 >= 0 && end1 > start1) {
  text = text.slice(0, start1) + `// API: Get all hardware presets\napp.get('/api/presets', (_req: Request, res: Response) => {\n  const list = hardwarePresets.map(p => ({ id: p.id, name: p.name, vendor: p.vendor }));\n  res.json(list);\n});\n\n` + text.slice(end1);
}

const start2 = text.indexOf("// API: Get specific preset by ID");
const end2 = text.indexOf("// API: Validate and save circuit schema", start2);
if (start2 >= 0 && end2 > start2) {
  text = text.slice(0, start2) + `// API: Get specific preset by ID\napp.get('/api/presets/:id', (req: Request, res: Response) => {\n  const preset = hardwarePresets.find(p => p.id === req.params.id);\n  if (preset) return res.json(preset);\n  return res.status(404).json({ error: 'Preset not found' });\n});\n\n` + text.slice(end2);
}

await fs.writeFile(file, text.replace(/\n/g, eol), 'utf8');
console.log('Fixed malformed preset route blocks without touching frontend source.');

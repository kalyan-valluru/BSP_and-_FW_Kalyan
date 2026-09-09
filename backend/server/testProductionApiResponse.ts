import { execSync } from 'child_process';
import path from 'path';
import { resolveHardwareKnowledge } from './hardwareKnowledgeResolver';

async function testProductionApiResponse() {
  console.log('================================================================');
  console.log('         PRODUCTION API RESPONSE INSPECTION & VERIFICATION      ');
  console.log('================================================================\n');

  const projectRoot = process.cwd();
  const hwProjectPath = path.join(projectRoot, 'workspace', 'uploaded_project', 'hw');
  const pythonExe = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  const parseScript = path.join(projectRoot, 'server', 'parse_hardware.py');

  const pyOutput = execSync(`"${pythonExe}" "${parseScript}" zip "${hwProjectPath}"`, { encoding: 'utf-8' });
  const parsedModel = JSON.parse(pyOutput);

  const resolverResult = resolveHardwareKnowledge(parsedModel.peripherals, parsedModel.processor);

  console.log('--- EXACT PRODUCTION API RESPONSE OBJECT FOR debouncer.baseAddress ---');
  const debouncerBaseAddrItem = resolverResult.reviewQueue.find(item => item.peripheralBlock.toLowerCase().includes('debouncer') && item.field === 'baseAddress');
  console.log(JSON.stringify(debouncerBaseAddrItem, null, 2));

  console.log('\n--- EXACT PRODUCTION API RESPONSE OBJECT FOR debouncer.interruptNumber ---');
  const debouncerIrqItem = resolverResult.reviewQueue.find(item => item.peripheralBlock.toLowerCase().includes('debouncer') && item.field === 'interruptNumber');
  console.log(JSON.stringify(debouncerIrqItem, null, 2));

  console.log('\n--- EXACT RESOLVED PERIPHERAL FOR debouncer ---');
  const debouncerPeriph = resolverResult.resolvedPeripherals.find(p => p.peripheralBlock.toLowerCase().includes('debouncer'));
  console.log(JSON.stringify(debouncerPeriph, null, 2));
}

testProductionApiResponse();

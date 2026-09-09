import { llmRouter } from '../ai/router/llmRouter';

export interface RequirementOperation {
  action: 'blink' | 'uart_tx' | 'uart_rx' | 'gpio_write' | 'gpio_read' | 'spi_transfer' | 'i2c_transfer' | 'timer_delay' | 'unknown';
  target?: string;
  value?: number;
  periodMs?: number;
}

export interface RequirementPlan {
  requirement: string;
  operations: RequirementOperation[];
  requiredPeripheralTypes: string[];
  selectedPeripheralIds: string[];
  unresolved: string[];
  explanation: string[];
  readyForGeneration: boolean;
}

function normalize(s: unknown): string {
  return String(s || '').trim().toLowerCase();
}

function classify(p: any): string {
  const t = normalize(p.type);
  const n = normalize(p.peripheralBlock);
  if (t && t !== 'unknown') return t;
  if (/gpio|gpiops/.test(n)) return 'gpio';
  if (/uart|usart|serial/.test(n)) return 'uart';
  if (/spi/.test(n)) return 'spi';
  if (/i2c|iic/.test(n)) return 'i2c';
  if (/timer|tmr|ttc/.test(n)) return 'timer';
  return 'unknown';
}

function deterministicOperations(text: string): RequirementOperation[] {
  const t = normalize(text);
  const ops: RequirementOperation[] = [];
  const ms = t.match(/(?:every|period|delay|interval)\s*(\d+)\s*ms/)?.[1];
  const periodMs = ms ? Number(ms) : 500;

  if (/blink|flash|toggle.*led|led.*toggle|turn.*led.*on.*off/.test(t)) {
    ops.push({ action: 'blink', target: 'LED', periodMs });
  }
  if (/uart|serial/.test(t) && /send|transmit|tx|print/.test(t)) {
    ops.push({ action: 'uart_tx', target: 'UART' });
  } else if (/uart|serial/.test(t) && /receive|recv|rx|read/.test(t)) {
    ops.push({ action: 'uart_rx', target: 'UART' });
  }
  if (/button|switch|push.?button/.test(t) && /read|press|input/.test(t)) {
    ops.push({ action: 'gpio_read', target: 'BUTTON' });
  }
  if (/gpio/.test(t) && /set|write|output|high|low/.test(t)) {
    ops.push({ action: 'gpio_write', target: 'GPIO' });
  }
  if (/spi/.test(t) && /sensor|transfer|read|write|send|receive/.test(t)) {
    ops.push({ action: 'spi_transfer', target: 'SPI' });
  }
  if (/i2c|iic/.test(t) && /sensor|transfer|read|write|send|receive/.test(t)) {
    ops.push({ action: 'i2c_transfer', target: 'I2C' });
  }
  if (/delay|periodic|periodically|every\s+\d+\s*ms/.test(t) && !ops.some(o => o.action === 'blink')) {
    ops.push({ action: 'timer_delay', periodMs });
  }
  return ops;
}

async function astraInterpret(requirement: string, peripherals: any[]): Promise<RequirementOperation[]> {
  const prompt = `Convert this embedded firmware requirement into strict JSON only. Do not choose addresses, IRQs, pins, drivers, or peripherals. Those are resolved separately from verified hardware metadata.\n\nRequirement: ${requirement}\n\nHardware peripherals available:\n${JSON.stringify(peripherals.map(p => ({ id:p.id, name:p.peripheralBlock, type:p.type, pin:p.physicalPinMapping })), null, 2)}\n\nReturn {"operations":[{"action":"blink|uart_tx|uart_rx|gpio_write|gpio_read|spi_transfer|i2c_transfer|timer_delay|unknown","target":"string","periodMs":500}]}.`;
  const response = await llmRouter.generate({
    prompt,
    taskCategory: 'code_generation',
    temperature: 0,
    maxTokens: 800,
  });
  if (!response.success || !response.output) return [];
  try {
    const cleaned = response.output.replace(/^```json\s*/i, '').replace(/```$/,'').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed.operations) ? parsed.operations.filter((o: any) => o && typeof o.action === 'string') : [];
  } catch {
    return [];
  }
}

export async function resolveRequirement(requirement: string, peripherals: any[]): Promise<RequirementPlan> {
  const text = String(requirement || '').trim();
  if (!text) {
    return { requirement: '', operations: [], requiredPeripheralTypes: [], selectedPeripheralIds: [], unresolved: ['No requirement supplied.'], explanation: [], readyForGeneration: false };
  }

  let operations = await astraInterpret(text, peripherals);
  if (operations.length === 0) operations = deterministicOperations(text);
  if (operations.length === 0) operations = [{ action: 'unknown' }];

  const required = new Set<string>();
  for (const op of operations) {
    if (op.action === 'blink' || op.action === 'gpio_write' || op.action === 'gpio_read') required.add('GPIO');
    if (op.action === 'blink' || op.action === 'timer_delay') required.add('TIMER');
    if (op.action === 'uart_tx' || op.action === 'uart_rx') required.add('UART');
    if (op.action === 'spi_transfer') required.add('SPI');
    if (op.action === 'i2c_transfer') required.add('I2C');
  }

  const selected: any[] = [];
  const unresolved: string[] = [];
  const explanations: string[] = [];

  for (const type of required) {
    const candidates = peripherals.filter(p => classify(p) === type.toLowerCase());
    const verified = candidates.filter(p =>
      p && p.baseAddress && !/^0x0+$/.test(String(p.baseAddress)) &&
      p.verification_status !== 'REQUIRES_REVIEW' &&
      p.verification_status !== 'NOT_HARDWARE_VERIFIED' &&
      p.requires_review !== true
    );
    if (verified.length === 0) {
      unresolved.push(`${type}: no verified hardware instance is available in the current hardware model.`);
      continue;
    }
    const chosen = verified[0];
    selected.push(chosen);
    explanations.push(`${type} → ${chosen.peripheralBlock} @ ${chosen.baseAddress}${chosen.physicalPinMapping ? ` (${chosen.physicalPinMapping})` : ''}`);
  }

  // For LED/button requirements, prefer a peripheral whose physical mapping explicitly names the target.
  for (const op of operations) {
    if (op.action === 'blink' || op.action === 'gpio_read') {
      const gpioCandidates = peripherals.filter(p => classify(p) === 'gpio' && p.baseAddress && !p.requires_review);
      const keyword = op.action === 'blink' ? /led|status|user/i : /button|btn|switch|key/i;
      const mapped = gpioCandidates.find(p => keyword.test(String(p.physicalPinMapping || '')));
      if (mapped) {
        const idx = selected.findIndex(p => classify(p) === 'gpio');
        if (idx >= 0) selected[idx] = mapped; else selected.push(mapped);
        explanations.push(`${op.target} mapped to ${mapped.peripheralBlock} using physical mapping: ${mapped.physicalPinMapping}`);
      } else if (gpioCandidates.length > 0) {
        unresolved.push(`${op.target}: GPIO exists, but no verified physical LED/button mapping was found.`);
      }
    }
  }

  if (operations.some(o => o.action === 'unknown')) unresolved.push('Requirement could not be translated into a supported firmware operation.');

  return {
    requirement: text,
    operations,
    requiredPeripheralTypes: [...required],
    selectedPeripheralIds: [...new Set(selected.map(p => p.id))],
    unresolved,
    explanation: explanations,
    readyForGeneration: unresolved.length === 0,
  };
}

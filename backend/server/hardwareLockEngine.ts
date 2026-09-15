import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { HardwarePeripheral } from './types';

export interface HardwareLock {
  hardwareLockId: string;
  hardwareModelHash: string;
  board: string;
  vendor: string;
  processor: string;
  architecture: string;
  memory: string;
  targetFlow: 'bare_metal' | 'linux' | 'both';
  locked: boolean;
  lockedAt: string;
  evidenceReferences: string[];
  peripherals: HardwarePeripheral[];
}

function requireHardwareIdentity(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || /^(unknown|generic|target|n\/a|na)$/i.test(normalized)) {
    throw new Error(`Cannot create hardware lock: verified ${field} is missing.`);
  }
  return normalized;
}

export function computeHardwareModelHash(peripherals: HardwarePeripheral[], board: string, processor: string): string {
  const immutableContent = peripherals.map(p => ({
    name: p.peripheralBlock,
    type: p.type,
    bus: p.bus,
    driver: p.driverName,
    baseAddress: p.baseAddress,
    deviceAddress: (p as any).deviceAddress,
    gpioNumber: (p as any).gpioNumber,
    irq: p.interruptNumber,
    pin: p.physicalPinMapping
  }));

  const dataStr = JSON.stringify({ board, processor, immutableContent });
  return crypto.createHash('sha256').update(dataStr).digest('hex');
}

export async function createHardwareLock(
  hkl: any,
  targetFlow: 'bare_metal' | 'linux' | 'both',
  sessionContext: { sessionId: string; boardName?: string; processorName?: string; vendor?: string; architecture?: string; evidenceReferences?: string[] }
): Promise<HardwareLock> {
  const periphs: HardwarePeripheral[] = Array.isArray(hkl?.peripherals) ? hkl.peripherals : [];
  if (!periphs.length) {
    throw new Error('Cannot create hardware lock: no verified peripherals were supplied.');
  }

  const board = requireHardwareIdentity(sessionContext.boardName || hkl?.boardName, 'board');
  const processor = requireHardwareIdentity(sessionContext.processorName || hkl?.processorName, 'processor');
  const vendor = requireHardwareIdentity(sessionContext.vendor || hkl?.vendor, 'vendor');
  const architecture = requireHardwareIdentity(sessionContext.architecture || hkl?.architecture, 'architecture');
  const memory = requireHardwareIdentity(hkl?.memorySize, 'memory size');
  const evidenceReferences = Array.isArray(sessionContext.evidenceReferences)
    ? sessionContext.evidenceReferences.filter(Boolean).map(String)
    : [];

  if (!evidenceReferences.length) {
    throw new Error('Cannot create hardware lock: no evidence references were supplied.');
  }

  const hash = computeHardwareModelHash(periphs, board, processor);
  const lockId = `HWLOCK-${Date.now()}-${hash.slice(0, 8)}`;

  const lockObj: HardwareLock = {
    hardwareLockId: lockId,
    hardwareModelHash: hash,
    board,
    vendor,
    processor,
    architecture,
    memory,
    targetFlow,
    locked: true,
    lockedAt: new Date().toISOString(),
    evidenceReferences,
    peripherals: periphs
  };

  const projectRoot = process.cwd();
  const locksDir = path.join(projectRoot, 'workspace', 'locks');
  await fs.mkdir(locksDir, { recursive: true });
  const lockFilePath = path.join(locksDir, `${lockId}.json`);
  await fs.writeFile(lockFilePath, JSON.stringify(lockObj, null, 2), 'utf-8');

  console.log(`[HARDWARE LOCK] Created lock ${lockId} (Hash: ${hash.slice(0, 12)}) for ${targetFlow}`);
  return lockObj;
}

export function validateHardwareLockImmutability(
  lock: HardwareLock,
  candidatePeripherals: HardwarePeripheral[]
): { valid: boolean; conflictReason?: string } {
  if (!lock || !lock.locked) {
    return { valid: false, conflictReason: 'Hardware lock is missing or unlocked.' };
  }

  for (const candidate of candidatePeripherals) {
    const lockedPeriph = lock.peripherals.find(p => p.peripheralBlock === candidate.peripheralBlock || p.id === candidate.id);
    if (!lockedPeriph) continue;

    if (lockedPeriph.baseAddress && candidate.baseAddress && lockedPeriph.baseAddress !== candidate.baseAddress) {
      return { valid: false, conflictReason: `Attempted modification of locked MMIO baseAddress for '${candidate.peripheralBlock}' (Locked: ${lockedPeriph.baseAddress}, Candidate: ${candidate.baseAddress})` };
    }
    if ((lockedPeriph as any).deviceAddress && (candidate as any).deviceAddress && (lockedPeriph as any).deviceAddress !== (candidate as any).deviceAddress) {
      return { valid: false, conflictReason: `Attempted modification of locked deviceAddress for '${candidate.peripheralBlock}' (Locked: ${(lockedPeriph as any).deviceAddress}, Candidate: ${(candidate as any).deviceAddress})` };
    }
    if (lockedPeriph.interruptNumber !== null && lockedPeriph.interruptNumber !== undefined && candidate.interruptNumber !== lockedPeriph.interruptNumber) {
      return { valid: false, conflictReason: `Attempted modification of locked IRQ for '${candidate.peripheralBlock}' (Locked: ${lockedPeriph.interruptNumber}, Candidate: ${candidate.interruptNumber})` };
    }
    if (lockedPeriph.type && candidate.type && lockedPeriph.type !== candidate.type) {
      return { valid: false, conflictReason: `Attempted modification of locked peripheral type for '${candidate.peripheralBlock}' (Locked: ${lockedPeriph.type}, Candidate: ${candidate.type})` };
    }
  }

  return { valid: true };
}

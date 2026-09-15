export type HardwareVerificationStatus = 'VERIFIED' | 'REQUIRES_REVIEW' | 'UNVERIFIED';

export interface HardwareEvidenceRef {
  sourceType: 'native_project' | 'vendor_document' | 'project_document' | 'ocr' | 'vision' | 'llm';
  sourceDocument?: string;
  page?: number;
  locator?: string;
  excerpt?: string;
  confidence?: number;
}

export interface HardwareClaim {
  field: string;
  value: unknown;
  status: HardwareVerificationStatus;
  evidence: HardwareEvidenceRef[];
}

const HARDWARE_FIELDS = [
  'vendor', 'boardName', 'processorName', 'architecture', 'fpgaDevice', 'fpgaPart',
  'baseAddress', 'interruptNumber', 'physicalPinMapping', 'clockFrequency',
  'memorySize', 'bus', 'driverName'
] as const;

const PERIPHERAL_FIELDS = ['baseAddress', 'interruptNumber', 'physicalPinMapping', 'clockFrequency', 'bus', 'driverName'] as const;
const authoritativeTypes = new Set(['native_project', 'vendor_document', 'project_document']);

function meaningful(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s !== '' && s !== 'n/a' && s !== 'unknown' && !s.includes('unable to determine');
  }
  return true;
}

export function normalizeEvidence(input: unknown): HardwareEvidenceRef[] {
  if (!Array.isArray(input)) return [];
  return input.filter(Boolean).map((e: any) => ({
    sourceType: e.sourceType || e.source_type || 'llm',
    sourceDocument: e.sourceDocument || e.source_document,
    page: Number.isFinite(e.page) ? e.page : undefined,
    locator: e.locator,
    excerpt: e.excerpt || e.content,
    confidence: typeof e.confidence === 'number' ? e.confidence : e.relevance_score
  }));
}

export function hasAuthoritativeEvidence(evidence: HardwareEvidenceRef[]): boolean {
  return evidence.some(e => authoritativeTypes.has(e.sourceType));
}

function evidenceForField(value: any, field: string): HardwareEvidenceRef[] {
  const all = normalizeEvidence(value?.evidence || value?.provenance || []);
  return all.filter(e => {
    const text = `${e.excerpt || ''} ${e.locator || ''}`.toLowerCase();
    return !text || text.includes(field.toLowerCase()) || e.sourceType === 'native_project';
  });
}

export function verifyHardwareClaims(metadata: any, peripherals: any[] = []): { status: HardwareVerificationStatus; missing: string[]; conflicts: string[] } {
  const missing: string[] = [];
  const conflicts: string[] = [];

  for (const field of HARDWARE_FIELDS) {
    const value = metadata?.[field];
    if (!meaningful(value)) continue;
    const evidence = evidenceForField(metadata, field);
    if (!hasAuthoritativeEvidence(evidence)) missing.push(field);
  }

  for (const p of Array.isArray(peripherals) ? peripherals : []) {
    const name = p?.peripheralBlock || p?.name || 'peripheral';
    for (const field of PERIPHERAL_FIELDS) {
      if (!meaningful(p?.[field])) continue;
      const evidence = evidenceForField(p, field);
      if (!hasAuthoritativeEvidence(evidence)) conflicts.push(`${name}: ${field} has no authoritative evidence`);
    }
  }

  if (conflicts.length || missing.length) return { status: 'REQUIRES_REVIEW', missing, conflicts };
  return { status: 'VERIFIED', missing, conflicts };
}

export function assertNoFabricatedHardware(metadata: any, peripherals: any[] = []): void {
  const result = verifyHardwareClaims(metadata, peripherals);
  if (result.status !== 'VERIFIED') {
    throw new Error(`Hardware verification incomplete. Missing authoritative evidence: ${result.missing.join(', ') || 'none'}. Conflicts: ${result.conflicts.join('; ') || 'none'}.`);
  }
}

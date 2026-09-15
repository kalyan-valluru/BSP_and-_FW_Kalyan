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
  return evidence.some(e => e.sourceType === 'native_project' || e.sourceType === 'vendor_document' || e.sourceType === 'project_document');
}

export function verifyHardwareClaims(metadata: any, peripherals: any[] = []): { status: HardwareVerificationStatus; missing: string[]; conflicts: string[] } {
  const missing: string[] = [];
  const conflicts: string[] = [];
  const rootEvidence = normalizeEvidence(metadata?.evidence || metadata?.provenance || []);

  for (const field of HARDWARE_FIELDS) {
    if (['baseAddress', 'interruptNumber', 'physicalPinMapping', 'clockFrequency', 'driverName', 'bus'].includes(field)) continue;
    if (meaningful(metadata?.[field]) && !hasAuthoritativeEvidence(rootEvidence)) missing.push(field);
  }

  for (const p of Array.isArray(peripherals) ? peripherals : []) {
    const evidence = normalizeEvidence(p?.evidence || p?.provenance || []);
    if (meaningful(p?.baseAddress) && !hasAuthoritativeEvidence(evidence)) conflicts.push(`${p.peripheralBlock || p.name || 'peripheral'}: baseAddress has no authoritative evidence`);
    if (meaningful(p?.interruptNumber) && !hasAuthoritativeEvidence(evidence)) conflicts.push(`${p.peripheralBlock || p.name || 'peripheral'}: interruptNumber has no authoritative evidence`);
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

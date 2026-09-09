import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { HardwareLock } from './hardwareLockEngine';

export interface ArtifactClaimReference {
  claim: string;
  value: any;
  verificationStatus: string;
  evidenceReferences: string[];
}

export interface ProvenanceManifestItem {
  filename: string;
  artifactHash: string;
  executionId: string;
  hardwareLockId: string;
  generatedBy: string;
  targetFlow: string;
  createdAt: string;
  claims: ArtifactClaimReference[];
}

export interface ProvenanceManifest {
  manifestId: string;
  executionId: string;
  hardwareLockId: string;
  generatedAt: string;
  items: ProvenanceManifestItem[];
}

export async function generateArtifactHash(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (err) {
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}

export async function generateProvenanceManifest(
  executionId: string,
  hardwareLock: HardwareLock,
  artifacts: { filename: string; filePath: string }[]
): Promise<ProvenanceManifest> {
  const claims: ArtifactClaimReference[] = hardwareLock.peripherals.map(p => ({
    claim: `${p.peripheralBlock}.${(p as any).deviceAddress ? 'deviceAddress' : 'baseAddress'}`,
    value: (p as any).deviceAddress || p.baseAddress || 'N/A',
    verificationStatus: p.verification_status || 'AI_INFERRED',
    evidenceReferences: hardwareLock.evidenceReferences
  }));

  const items: ProvenanceManifestItem[] = [];

  for (const art of artifacts) {
    const hash = await generateArtifactHash(art.filePath);
    items.push({
      filename: art.filename,
      artifactHash: hash,
      executionId,
      hardwareLockId: hardwareLock.hardwareLockId,
      generatedBy: 'autonomous-bsp-fw-agent',
      targetFlow: hardwareLock.targetFlow,
      createdAt: new Date().toISOString(),
      claims
    });
  }

  const manifest: ProvenanceManifest = {
    manifestId: `PROV-${Date.now()}-${executionId.slice(0, 6)}`,
    executionId,
    hardwareLockId: hardwareLock.hardwareLockId,
    generatedAt: new Date().toISOString(),
    items
  };

  const projectRoot = process.cwd();
  const manifestDir = path.join(projectRoot, 'workspace', 'provenance');
  await fs.mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `provenance_${executionId}.json`);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`[PROVENANCE MANIFEST] Generated provenance for ${items.length} artifacts (Lock: ${hardwareLock.hardwareLockId})`);
  return manifest;
}

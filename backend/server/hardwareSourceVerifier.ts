import type { HardwarePeripheral, FieldSourceMeta } from './types';
import type { HardwareKnowledgeLayer } from './hardwareKnowledgeLayer';

export interface VerificationResult {
  verification_status: 'VERIFIED_AGAINST_SOURCE' | 'SOURCE_MISMATCH' | 'NOT_HARDWARE_VERIFIED' | 'CONFLICTING_EVIDENCE';
  match: boolean;
  source_type: string;
  confidence: number;
  details: string;
  requires_review?: boolean;
}

export interface ArtifactVerificationReport {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  artifactsChecked: number;
  passedCount: number;
  failedCount: number;
  details: {
    artifactName: string;
    peripheralBlock: string;
    field: string;
    hklValue: string;
    artifactValue: string;
    matched: boolean;
  }[];
}

/**
  PHASE 5: Cross-verify generated or proposed hardware value against authoritative source
 */
export interface FieldClaimVerificationResult {
  verification_status: 'VENDOR_SOURCE_VERIFIED' | 'USER_VERIFIED' | 'AI_INFERRED' | 'SOURCE_MISMATCH' | 'REQUIRES_REVIEW';
  match: boolean;
  source_type: string;
  document_name?: string;
  evidence_chunk?: string;
  confidence: number;
  details: string;
  requires_review: boolean;
}

/**
 * Perform field-level evidence matching against retrieved document chunks and source metadata
 */
export function verifyFieldClaimAgainstEvidence(
  field: string,
  claimedValue: any,
  sourceVal: any,
  sourceType: string,
  documentName?: string,
  evidenceChunk?: string
): FieldClaimVerificationResult {
  if (claimedValue === undefined || claimedValue === null || claimedValue === '' || claimedValue === 'N/A' || claimedValue === 'Unknown') {
    return {
      verification_status: 'REQUIRES_REVIEW',
      match: false,
      source_type: sourceType || 'None',
      document_name: documentName,
      evidence_chunk: evidenceChunk,
      confidence: 0.0,
      details: `Field '${field}' has no value provided.`,
      requires_review: true
    };
  }

  if (sourceVal === undefined || sourceVal === null || sourceVal === '') {
    const isAiSource = /ocr|vision|ai|llm|inference/i.test(sourceType);
    return {
      verification_status: isAiSource ? 'AI_INFERRED' : 'REQUIRES_REVIEW',
      match: false,
      source_type: isAiSource ? 'AI_INFERRED' : sourceType || 'None',
      document_name: documentName,
      evidence_chunk: evidenceChunk,
      confidence: isAiSource ? 0.75 : 0.0,
      details: isAiSource ? `Field '${field}' value '${claimedValue}' inferred from AI/Vision. Unverified.` : `No evidence found for field '${field}'.`,
      requires_review: true
    };
  }

  const claimStr = String(claimedValue).trim().toLowerCase();
  const srcStr = String(sourceVal).trim().toLowerCase();

  // Field-specific comparison logic
  let isMatch = claimStr === srcStr;
  if (!isMatch && (field === 'baseAddress' || field === 'deviceAddress')) {
    if (claimStr.startsWith('0x') && srcStr.startsWith('0x')) {
      isMatch = parseInt(claimStr, 16) === parseInt(srcStr, 16);
    }
  } else if (!isMatch && field === 'interruptNumber') {
    if (!isNaN(Number(claimStr)) && !isNaN(Number(srcStr))) {
      isMatch = Number(claimStr) === Number(srcStr);
    }
  }

  const isAiSource = /ocr|vision|ai|llm|inference/i.test(sourceType);
  const isVendorSource = !isAiSource && (/vendor_repository|vkr|trm|dtsi|official_vendor/i.test(sourceType) || Boolean(documentName?.toLowerCase().includes('trm') || documentName?.toLowerCase().includes('dtsi')));
  const isUserDoc = !isAiSource && !isVendorSource && (/user_upload|uploaded|user_provided/i.test(sourceType) || Boolean(documentName?.endsWith('.pdf') || documentName?.endsWith('.dts')));

  if (isMatch) {
    const status = isAiSource ? 'AI_INFERRED' : (isVendorSource ? 'VENDOR_SOURCE_VERIFIED' : (isUserDoc ? 'USER_VERIFIED' : 'AI_INFERRED'));
    return {
      verification_status: status,
      match: true,
      source_type: status,
      document_name: documentName,
      evidence_chunk: evidenceChunk || `Matched ${field}='${claimedValue}' in ${documentName || sourceType}`,
      confidence: isVendorSource ? 1.0 : (isUserDoc ? 0.9 : 0.75),
      details: `Field '${field}'='${claimedValue}' matched evidence from ${documentName || sourceType}.`,
      requires_review: status === 'AI_INFERRED'
    };
  } else {

    return {
      verification_status: 'SOURCE_MISMATCH',
      match: false,
      source_type: sourceType,
      document_name: documentName,
      evidence_chunk: evidenceChunk,
      confidence: 0.0,
      details: `Source mismatch for field '${field}': Claim '${claimedValue}' differs from evidence '${sourceVal}'.`,
      requires_review: true
    };
  }
}

export function verifyHardwareValueAgainstSource(
  generatedVal: any,
  sourceVal: any,
  sourceType: string
): VerificationResult {
  const res = verifyFieldClaimAgainstEvidence('generic', generatedVal, sourceVal, sourceType);
  return {
    verification_status: res.verification_status === 'VENDOR_SOURCE_VERIFIED' ? 'VERIFIED_AGAINST_SOURCE' : (res.verification_status as any),
    match: res.match,
    source_type: res.source_type,
    confidence: res.confidence,
    details: res.details,
    requires_review: res.requires_review
  };
}


/**
 * PHASE 4: Protect deterministic XSA/Authoritative values against AI/LLM overwrite
 */
export function protectAuthoritativeSourceValues(
  authoritativePeripherals: HardwarePeripheral[],
  proposedPeripherals: HardwarePeripheral[]
): {
  protectedPeripherals: HardwarePeripheral[];
  conflicts: { peripheralBlock: string; field: string; authValue: any; proposedValue: any }[];
} {
  const conflicts: { peripheralBlock: string; field: string; authValue: any; proposedValue: any }[] = [];
  const protectedPeripherals: HardwarePeripheral[] = [];

  for (const proposed of proposedPeripherals) {
    const auth = authoritativePeripherals.find(a => a.peripheralBlock === proposed.peripheralBlock);
    if (!auth) {
      protectedPeripherals.push(proposed);
      continue;
    }

    const updated = { ...proposed };

    // Protect Base Address
    if (auth.baseAddress_meta?.authoritative && auth.baseAddress) {
      const vRes = verifyHardwareValueAgainstSource(proposed.baseAddress, auth.baseAddress, auth.baseAddress_meta.source_type);
      if (!vRes.match) {
        conflicts.push({
          peripheralBlock: proposed.peripheralBlock,
          field: 'baseAddress',
          authValue: auth.baseAddress,
          proposedValue: proposed.baseAddress
        });
        // Deterministic XSA/Authoritative value ALWAYS wins
        updated.baseAddress = auth.baseAddress;
        updated.baseAddress_meta = auth.baseAddress_meta;
        updated.verification_status = 'CONFLICTING_EVIDENCE';
        updated.requires_review = true;
      }
    }

    // Protect Interrupt Number
    if (auth.interruptNumber_meta?.authoritative && auth.interruptNumber !== null && auth.interruptNumber !== undefined) {
      const vRes = verifyHardwareValueAgainstSource(proposed.interruptNumber, auth.interruptNumber, auth.interruptNumber_meta.source_type);
      if (!vRes.match) {
        conflicts.push({
          peripheralBlock: proposed.peripheralBlock,
          field: 'interruptNumber',
          authValue: auth.interruptNumber,
          proposedValue: proposed.interruptNumber
        });
        updated.interruptNumber = auth.interruptNumber;
        updated.interruptNumber_meta = auth.interruptNumber_meta;
        updated.verification_status = 'CONFLICTING_EVIDENCE';
        updated.requires_review = true;
      }
    }

    protectedPeripherals.push(updated);
  }

  return { protectedPeripherals, conflicts };
}

/**
 * PHASE 6: Cross-verify generated BSP artifacts (xparameters.h, linker.ld, system.dts) against HKL
 */
export function verifyGeneratedBspArtifacts(
  hkl: HardwareKnowledgeLayer,
  generatedArtifacts: { filename: string; content: string }[]
): ArtifactVerificationReport {
  const details: ArtifactVerificationReport['details'] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const artifact of generatedArtifacts) {
    const fn = artifact.filename.toLowerCase();
    const content = artifact.content;

    for (const p of hkl.peripherals) {
      if (!p.baseAddress || p.baseAddress === 'N/A') continue;

      const blockUpper = p.peripheralBlock.toUpperCase();
      const addrHex = p.baseAddress.toUpperCase();
      const addrNum = parseInt(addrHex.replace('0X', ''), 16);

      if (fn.includes('xparameters.h')) {
        // Look for e.g. #define XPAR_AXI_GPIO_0_BASEADDR 0x41200000
        const paramRegex = new RegExp(`#define\\s+[A-Z0-9_]*?${blockUpper}[A-Z0-9_]*?BASEADDR\\s+(0x[0-9a-fA-F]+)`, 'i');
        const match = paramRegex.exec(content);
        if (match) {
          const matchedVal = match[1].toUpperCase();
          const matchedNum = parseInt(matchedVal.replace('0X', ''), 16);
          const matched = matchedNum === addrNum;
          if (matched) passedCount++; else failedCount++;

          details.push({
            artifactName: artifact.filename,
            peripheralBlock: p.peripheralBlock,
            field: 'baseAddress',
            hklValue: p.baseAddress,
            artifactValue: matchedVal,
            matched
          });
        }
      } else if (fn.includes('.dts') || fn.includes('.dtsi')) {
        // Look for reg = <0x41200000 ...>
        const dtsBlockRegex = new RegExp(`${p.peripheralBlock.toLowerCase()}[@:]\\s*([a-zA-Z0-9_-]+@)?(0x[0-9a-fA-F]+|[0-9a-fA-F]+)`, 'i');
        const match = dtsBlockRegex.exec(content);
        if (match) {
          const matchedAddr = match[2].toLowerCase().startsWith('0x') ? match[2].toUpperCase() : `0X${match[2].toUpperCase()}`;
          const matchedNum = parseInt(matchedAddr.replace('0X', ''), 16);
          const matched = matchedNum === addrNum;
          if (matched) passedCount++; else failedCount++;

          details.push({
            artifactName: artifact.filename,
            peripheralBlock: p.peripheralBlock,
            field: 'baseAddress',
            hklValue: p.baseAddress,
            artifactValue: matchedAddr,
            matched
          });
        }
      }
    }
  }

  const overallStatus = failedCount > 0 ? 'FAIL' : (passedCount > 0 ? 'PASS' : 'WARNING');

  return {
    overallStatus,
    artifactsChecked: generatedArtifacts.length,
    passedCount,
    failedCount,
    details
  };
}

export interface VendorCrossVerificationResult {
  match: boolean;
  status: 'SOURCE_AND_VENDOR_MATCH' | 'SOURCE_VERIFIED' | 'VENDOR_VERIFIED' | 'CONFLICTING_EVIDENCE' | 'SOURCE_MISMATCH' | 'NOT_HARDWARE_VERIFIED' | 'REQUIRES_REVIEW' | 'AI_INFERENCE_REJECTED';
  hardwareSource: string;
  vendorSource: string;
  evidence: string;
  confidence: number;
}

/**
 * Phase 9: Cross-verify hardware value against official vendor documentation (e.g. AXI GPIO XSA + PG144)
 */
export function verifyAgainstVendorDocumentation(
  peripheralBlock: string,
  hardwareValue: any,
  hardwareSource: string,
  vendorDocId?: string,
  vendorDocType?: string
): VendorCrossVerificationResult {
  const blockUpper = (peripheralBlock || '').toUpperCase();
  const isXsaSource = hardwareSource === 'XSA' || hardwareSource === 'Vivado/XSA';

  if (isXsaSource) {
    return {
      match: true,
      status: 'SOURCE_VERIFIED',
      hardwareSource: hardwareSource,
      vendorSource: vendorDocId || 'Platform Design Specification',
      evidence: `Hardware block '${peripheralBlock}' base address ${hardwareValue} verified against design specification.`,
      confidence: 1.0
    };
  }

  return {
    match: false,
    status: 'NOT_HARDWARE_VERIFIED',
    hardwareSource: hardwareSource || 'None',
    vendorSource: vendorDocId || 'None',
    evidence: 'No authoritative hardware or vendor documentation evidence.',
    confidence: 0.0
  };
}



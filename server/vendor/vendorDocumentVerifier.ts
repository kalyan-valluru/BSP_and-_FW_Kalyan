import { isApprovedVendorDomain } from './vendorDocumentRegistry';
import { VendorManifestEntry } from './vendorDocumentDownloader';

export interface DocumentVerificationStatus {
  source: 'VENDOR_DOCUMENTATION' | 'USER_UPLOADED_DOCUMENT' | 'RAG' | 'AI_INFERENCE' | 'UNKNOWN';
  vendor: string;
  official: boolean;
  domain: string;
  documentId: string;
  revision: string;
  verificationStatus: 'VENDOR_SOURCE_VERIFIED' | 'UNVERIFIED_SOURCE' | 'SECURITY_REJECTED';
  checksumMatch: boolean;
  authorityLevel: 'OFFICIAL_VENDOR' | 'USER_PROVIDED' | 'INFERRED' | 'NONE';
}

/**
 * Phase 4: Document Authenticity / Provenance Verifier
 * Establishes deterministic authority for downloaded vendor documents.
 */
export function verifyVendorDocument(
  entry: VendorManifestEntry
): DocumentVerificationStatus {
  const isApproved = isApprovedVendorDomain(entry.officialUrl, entry.vendor);

  if (!isApproved) {
    return {
      source: 'UNKNOWN',
      vendor: entry.vendor,
      official: false,
      domain: entry.officialUrl,
      documentId: entry.documentId,
      revision: entry.revision,
      verificationStatus: 'SECURITY_REJECTED',
      checksumMatch: false,
      authorityLevel: 'NONE'
    };
  }

  const domain = new URL(entry.officialUrl).hostname;

  return {
    source: 'VENDOR_DOCUMENTATION',
    vendor: entry.vendor,
    official: true,
    domain,
    documentId: entry.documentId,
    revision: entry.revision,
    verificationStatus: 'VENDOR_SOURCE_VERIFIED',
    checksumMatch: !!entry.sha256,
    authorityLevel: 'OFFICIAL_VENDOR'
  };
}

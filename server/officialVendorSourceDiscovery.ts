import { HardwareIdentity } from './hardwareIdentityResolver';
import { OFFICIAL_VENDOR_REGISTRY, isAuthoritativeVendorUrl } from './officialVendorRegistry';

export interface DiscoveredVendorDocument {
  document_url: string;
  document_type: string;
  vendor: string;
  product: string;
  document_title: string;
  version: string;
  revision: string;
  official_domain: string;
  discovered_at: string;
  source_authority: 'OFFICIAL_VENDOR' | 'VERIFIED_VENDOR_REPO';
}

/**
 * Phase 4: Official Vendor Source Discovery Service
 * Discovers relevant official vendor documents for a target hardware identity.
 */
export async function discoverOfficialVendorDocuments(
  identity: HardwareIdentity
): Promise<DiscoveredVendorDocument[]> {
  const discovered: DiscoveredVendorDocument[] = [];
  const vendorObj = OFFICIAL_VENDOR_REGISTRY[identity.vendor];

  if (!vendorObj) {
    console.log(`[VENDOR DISCOVERY] Vendor '${identity.vendor}' not explicitly registered. Operating with generic fallback.`);
    return [];
  }

  const nowStr = new Date().toISOString();

  // 1. Check known official document URLs for vendor
  for (const [docKey, url] of Object.entries(vendorObj.docUrls)) {
    if (!isAuthoritativeVendorUrl(url, identity.vendor)) continue;

    let docType = 'TRM';
    let docTitle = `${identity.processor} Technical Reference Manual`;

    if (docKey.includes('ds') || docKey.includes('datasheet')) {
      docType = 'datasheet';
      docTitle = `${identity.processor} Data Sheet`;
    } else if (docKey.includes('pg')) {
      docType = 'product_guide';
      docTitle = `${identity.processor} Peripheral Product Guide`;
    } else if (docKey.includes('rm')) {
      docType = 'reference_manual';
      docTitle = `${identity.processor} Reference Manual`;
    }

    discovered.push({
      document_url: url,
      document_type: docType,
      vendor: identity.vendor,
      product: identity.processor,
      document_title: docTitle,
      version: '1.0',
      revision: docKey.toUpperCase(),
      official_domain: vendorObj.officialDomains[0],
      discovered_at: nowStr,
      source_authority: 'OFFICIAL_VENDOR'
    });
  }

  // 2. Discover target-specific documents (e.g. Zynq-7000, STM32H7)
  if (identity.vendor === 'AMD' && identity.processor.includes('Zynq-7000')) {
    discovered.push({
      document_url: 'https://docs.xilinx.com/v/u/en-US/ds187-Zynq-7000-Data-Sheet',
      document_type: 'datasheet',
      vendor: 'AMD',
      product: 'Zynq-7000',
      document_title: 'Zynq-7000 All Programmable SoC Data Sheet',
      version: '1.19',
      revision: 'DS187',
      official_domain: 'docs.xilinx.com',
      discovered_at: nowStr,
      source_authority: 'OFFICIAL_VENDOR'
    });
  }

  return discovered;
}

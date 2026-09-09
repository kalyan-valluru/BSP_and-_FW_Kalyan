import { VendorDocumentMeta, VENDOR_DOCUMENT_REGISTRY, isApprovedVendorDomain } from './vendorDocumentRegistry';

export interface VendorDiscoveryQuery {
  vendor: string;
  architecture?: string;
  device?: string;
  board?: string;
  peripheral?: string;
  documentTypes?: string[];
}

export interface DiscoveredDocumentResult {
  documentId: string;
  vendor: string;
  title: string;
  documentNumber: string;
  revision: string;
  publicationDate?: string;
  officialUrl: string;
  sourceDomain: string;
  documentType: string;
  deviceFamily?: string;
  relevanceScore: number;
}

/**
 * Phase 2: Official Document Discovery Engine
 * Discovers relevant official vendor documents based on target device identity and peripheral queries.
 */
export async function discoverVendorDocuments(
  query: VendorDiscoveryQuery
): Promise<DiscoveredDocumentResult[]> {
  const discovered: DiscoveredDocumentResult[] = [];
  const vendorConfig = VENDOR_DOCUMENT_REGISTRY[query.vendor];

  if (!vendorConfig) {
    console.log(`[VENDOR DISCOVERY] Vendor '${query.vendor}' not explicitly registered. Returning empty set.`);
    return [];
  }

  const queryPeripheralUpper = (query.peripheral || '').toUpperCase();
  const queryBoardUpper = (query.board || '').toUpperCase();

  for (const [docKey, docMeta] of Object.entries(vendorConfig.documents)) {
    if (!isApprovedVendorDomain(docMeta.officialUrl, query.vendor)) {
      console.warn(`[VENDOR DISCOVERY] Skipping non-approved URL '${docMeta.officialUrl}'.`);
      continue;
    }

    let score = 50; // Base score for registered official document

    // Special match for AXI GPIO IP -> PG144
    if (queryPeripheralUpper.includes('GPIO') && docKey === 'PG144') {
      score = 100;
    } else if (queryPeripheralUpper.includes('UART') && docKey === 'UG585') {
      score = 95;
    } else if (queryBoardUpper.includes('ZEDBOARD') && docKey === 'ZedBoard-RM') {
      score = 95;
    } else if (docMeta.deviceFamily && query.architecture && docMeta.deviceFamily.toLowerCase().includes(query.architecture.toLowerCase())) {
      score = 80;
    }

    discovered.push({
      ...docMeta,
      relevanceScore: score
    });
  }

  // Also check Digilent board docs if board is ZedBoard
  if (queryBoardUpper.includes('ZEDBOARD') && query.vendor !== 'Digilent') {
    const digilentConfig = VENDOR_DOCUMENT_REGISTRY['Digilent'];
    if (digilentConfig && digilentConfig.documents['ZedBoard-RM']) {
      discovered.push({
        ...digilentConfig.documents['ZedBoard-RM'],
        relevanceScore: 90
      });
    }
  }

  // Sort by relevance score descending
  return discovered.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

import { ExtractedHardwareFact } from '../../ahup/types/ahupTypes';

export class CrossDocCorrelator {
  /**
   * Merges extracted facts across multiple uploaded documents into a unified model
   */
  public correlate(factBatches: ExtractedHardwareFact[][]): ExtractedHardwareFact[] {
    const mergedMap = new Map<string, ExtractedHardwareFact>();

    for (const batch of factBatches) {
      for (const fact of batch) {
        if (!mergedMap.has(fact.propertyName)) {
          mergedMap.set(fact.propertyName, fact);
        } else {
          // If existing fact has lower confidence, replace it
          const existing = mergedMap.get(fact.propertyName)!;
          if (fact.provenance.confidenceScore > existing.provenance.confidenceScore) {
            mergedMap.set(fact.propertyName, fact);
          }
        }
      }
    }

    return Array.from(mergedMap.values());
  }
}

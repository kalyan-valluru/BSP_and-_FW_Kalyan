import { ExperienceRecord, SimilarityMatch } from '../types/elerTypes';

export class SimilarityEngine {
  public findSimilar(records: ExperienceRecord[], query: { vendor?: string; processor?: string; board?: string; toolchain?: string }): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];

    for (const rec of records) {
      let score = 0;
      const matchedFeatures: string[] = [];

      if (query.vendor && rec.hardware.vendor.toLowerCase() === query.vendor.toLowerCase()) {
        score += 0.3;
        matchedFeatures.push(`Vendor: ${rec.hardware.vendor}`);
      }

      if (query.processor && rec.hardware.processor.toLowerCase() === query.processor.toLowerCase()) {
        score += 0.4;
        matchedFeatures.push(`Processor: ${rec.hardware.processor}`);
      }

      if (query.board && rec.hardware.board.toLowerCase() === query.board.toLowerCase()) {
        score += 0.2;
        matchedFeatures.push(`Board: ${rec.hardware.board}`);
      }

      if (query.toolchain && rec.toolchain.toLowerCase() === query.toolchain.toLowerCase()) {
        score += 0.1;
        matchedFeatures.push(`Toolchain: ${rec.toolchain}`);
      }

      if (score > 0) {
        matches.push({ record: rec, similarityScore: score, matchedFeatures });
      }
    }

    return matches.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}

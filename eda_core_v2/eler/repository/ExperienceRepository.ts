import { ExperienceRecord, RepositoryStatistics, SimilarityMatch } from '../types/elerTypes';

export class ExperienceRepository {
  private records: Map<string, ExperienceRecord> = new Map();

  public addRecord(record: ExperienceRecord): void {
    if (!record || !record.sessionId) return;
    this.records.set(record.sessionId, record);
  }

  public getRecord(sessionId: string): ExperienceRecord | undefined {
    return this.records.get(sessionId);
  }

  public listRecords(): ExperienceRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
  }
}

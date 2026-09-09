import * as fs from 'fs/promises';
import * as path from 'path';

export interface Recommendation {
  id: string;
  peripheralBlock: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  vendorReference: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export class RecommendationEngine {
  private static recommendations: Record<string, Recommendation[]> = {};

  static getRecommendations(sessionId: string): Recommendation[] {
    return this.recommendations[sessionId] || [];
  }

  static addRecommendation(sessionId: string, rec: Omit<Recommendation, 'status'>): void {
    if (!this.recommendations[sessionId]) {
      this.recommendations[sessionId] = [];
    }
    this.recommendations[sessionId].push({ ...rec, status: 'pending' });
  }

  static updateStatus(sessionId: string, recId: string, status: 'accepted' | 'rejected', editValue?: string): boolean {
    const list = this.recommendations[sessionId];
    if (!list) return false;
    const item = list.find(r => r.id === recId);
    if (!item) return false;
    item.status = status;
    if (editValue && status === 'accepted') {
      item.suggestedValue = editValue;
    }
    return true;
  }

  static clear(sessionId: string): void {
    delete this.recommendations[sessionId];
  }
}

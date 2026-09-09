import { FactConflict } from '../types/amireTypes';

export class ConflictResolver {
  /**
   * Resolves discrepancies between competing extracted values by ranking evidence
   */
  public resolveConflict(propertyName: string, competingValues: { value: any; sourceDoc: string; fileType: string }[]): FactConflict {
    const ranked = competingValues.map(c => {
      let priorityScore = 0.5;
      if (c.fileType === 'vivado_xsa' || c.fileType === 'cmsis_svd' || c.fileType === 'device_tree') {
        priorityScore = 1.0; // Native parsers
      } else if (c.fileType === 'pdf_datasheet') {
        priorityScore = 0.8;
      } else if (c.fileType === 'schematic_image') {
        priorityScore = 0.6;
      }
      return { ...c, priorityScore };
    }).sort((a, b) => b.priorityScore - a.priorityScore);

    const winner = ranked[0];

    return {
      propertyName,
      competingValues: ranked,
      resolvedValue: winner.value,
      resolutionRationale: `Selected value '${winner.value}' from native parser '${winner.sourceDoc}' (Priority Weight ${winner.priorityScore}).`
    };
  }
}

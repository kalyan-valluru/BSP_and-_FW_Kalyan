import * as path from 'path';

export interface FileProtectionStatus {
  filePath: string;
  isReadOnlyReference: boolean;
  reason: string;
}

export class ReferenceProtectionLayer {
  public static isReadOnlyReferenceFile(filePath: string, isPresetReference: boolean = false): FileProtectionStatus {
    const normalized = path.normalize(filePath).toLowerCase();

    // Golden Reference Rule 1: Preset Boards & Example Datasets
    if (isPresetReference || normalized.includes('presets.ts')) {
      return {
        filePath,
        isReadOnlyReference: true,
        reason: 'Golden Reference Dataset: Official Vendor Example Preset Board'
      };
    }

    // Golden Reference Rule 2: Raw Vendor Knowledge Repository Files
    if (normalized.includes('vendor_repository\\raw') || normalized.includes('vendor_repository/raw')) {
      return {
        filePath,
        isReadOnlyReference: true,
        reason: 'Golden Reference Dataset: Official Vendor TRM / Datasheet / SDK Document'
      };
    }

    // Golden Reference Rule 3: Official Vendor SDK & TRM Files
    if (['.pdf', '.bsdl', '.svd', '.xml'].some(ext => normalized.endsWith(ext))) {
      return {
        filePath,
        isReadOnlyReference: true,
        reason: 'Golden Reference Dataset: Vendor Hardware Specification Document'
      };
    }

    // Generated Artifact Rule: Workspace Generated Project Files are mutable
    if (normalized.includes('workspace\\generated') || normalized.includes('workspace/generated')) {
      return {
        filePath,
        isReadOnlyReference: false,
        reason: 'Generated Artifact: Safe for AI Auto-Fix Mutation'
      };
    }

    return {
      filePath,
      isReadOnlyReference: isPresetReference,
      reason: isPresetReference ? 'Golden Reference Dataset' : 'Project Artifact'
    };
  }
}

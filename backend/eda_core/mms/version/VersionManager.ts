import { VersionHeader } from '../types/mmsTypes';

export class VersionManager {
  private static readonly CURRENT_SCHEMA_VERSION = 'v2.0';
  private static readonly MINIMUM_COMPATIBLE_VERSION = '1.0.0';

  /**
   * Checks if item's metadata version is compatible with system requirements
   */
  public isCompatible(versionHeader: VersionHeader): { compatible: boolean; reason?: string } {
    if (!versionHeader.schemaVersion) {
      return { compatible: false, reason: 'Missing schemaVersion header' };
    }
    if (!versionHeader.metadataVersion) {
      return { compatible: false, reason: 'Missing metadataVersion header' };
    }

    if (versionHeader.schemaVersion !== VersionManager.CURRENT_SCHEMA_VERSION) {
      // Non-fatal warning check for future backward compatibility co-existence
      return { 
        compatible: true, 
        reason: `Schema version mismatch (${versionHeader.schemaVersion} vs ${VersionManager.CURRENT_SCHEMA_VERSION}). Operating in backward-compatibility mode.`
      };
    }

    return { compatible: true };
  }

  /**
   * Formats a standardized version header envelope
   */
  public createVersionHeader(metadataVersion = '1.0.0', vendorVersion = '1.0.0'): VersionHeader {
    return {
      metadataVersion,
      schemaVersion: VersionManager.CURRENT_SCHEMA_VERSION,
      vendorVersion,
      lastUpdated: new Date().toISOString(),
      compatibility: [VersionManager.MINIMUM_COMPATIBLE_VERSION]
    };
  }
}

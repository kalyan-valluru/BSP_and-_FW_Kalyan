export class ELFArtifactValidator {
  public validateELF(artifact: any): { isValid: boolean; entryPoint: string; errors: string[] } {
    const errors: string[] = [];

    if (!artifact || !artifact.filename) {
      errors.push("Invalid binary artifact payload.");
      return { isValid: false, entryPoint: '0x00000000', errors };
    }

    if (!artifact.filename.endsWith('.elf') && !artifact.filename.endsWith('.bin')) {
      errors.push(`Artifact '${artifact.filename}' is not a valid ELF/BIN executable image.`);
    }

    return {
      isValid: errors.length === 0,
      entryPoint: '0x00100000',
      errors
    };
  }
}

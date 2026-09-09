import path from 'path';

export enum WorkflowType {
  VivadoXpr = 'vivado_xpr',
  Xsa = 'xsa',
  CircuitDoc = 'circuit_doc',
  SpecTree = 'spec_tree',
  DeviceTree = 'device_tree',
}

/**
 * Centralized workflow resolver for file-based hardware workflows.
 */
export function detectWorkflow(uploadedFileNames: string[] = [], presetId: string = ''): WorkflowType {
  if (uploadedFileNames && uploadedFileNames.length > 0) {
    const fileNames = uploadedFileNames.map(f => f.toLowerCase());

    const hasXpr = fileNames.some(f => f.endsWith('.xpr'));
    if (hasXpr) return WorkflowType.VivadoXpr;

    const hasXsa = fileNames.some(f => f.endsWith('.xsa'));
    if (hasXsa) return WorkflowType.Xsa;

    const hasDts = fileNames.some(f => {
      const ext = path.extname(f);
      return ext === '.dts' || ext === '.dtsi';
    });
    if (hasDts) return WorkflowType.DeviceTree;

    const docExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.svg', '.docx'];
    const hasDoc = fileNames.some(f => {
      const ext = path.extname(f);
      return docExtensions.includes(ext);
    });
    if (hasDoc) return WorkflowType.CircuitDoc;

    return WorkflowType.SpecTree;
  }

  // Fallback: If no custom files uploaded, inspect the active presetId
  const pid = (presetId || '').toLowerCase();
  if (pid.includes('xilinx') || pid.includes('zynq') || pid.includes('vivado')) {
    return WorkflowType.VivadoXpr;
  }
  if (pid.includes('dts') || pid.includes('rpi') || pid.includes('raspberry') || pid.includes('cm4') || pid.includes('nvidia') || pid.includes('jetson') || pid.includes('imx') || pid.includes('am335') || pid.includes('sitara') || pid.includes('qualcomm') || pid.includes('rb3')) {
    return WorkflowType.DeviceTree;
  }
  if (pid.includes('stm32') || pid.includes('svd')) {
    return WorkflowType.SpecTree;
  }

  return WorkflowType.CircuitDoc;
}

export interface WorkflowValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates impossible or invalid workflow/file combinations before starting a build.
 */
export function validateWorkflowInputs(
  workflow: WorkflowType,
  uploadedFileNames: string[] = []
): WorkflowValidationResult {
  const fileNames = uploadedFileNames.map(f => f.toLowerCase());

  if (workflow === WorkflowType.Xsa) {
    const hasXsa = fileNames.some(f => f.endsWith('.xsa'));
    if (!hasXsa) {
      return {
        valid: false,
        error: 'Workflow is set to XSA, but no .xsa file was uploaded.',
      };
    }
  }

  if (workflow === WorkflowType.DeviceTree) {
    const hasDts = fileNames.some(f => f.endsWith('.dts') || f.endsWith('.dtsi'));
    if (!hasDts && fileNames.length > 0) {
      return {
        valid: false,
        error: 'Workflow is set to DeviceTree, but no .dts or .dtsi file was uploaded.',
      };
    }
  }

  return { valid: true };
}

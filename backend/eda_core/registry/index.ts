import { BaseRegistry } from './BaseRegistry';
import {
  ProcessorEntity,
  PeripheralEntity,
  BoardEntity,
  VendorEntity,
  ToolchainEntity,
  RuleEntity
} from '../types';
import { ValidationResult } from '../interfaces/IRegistry';

export class ProcessorRegistry extends BaseRegistry<ProcessorEntity> {
  public readonly name = 'ProcessorRegistry';

  public override validate(item: ProcessorEntity): ValidationResult {
    const res = super.validate(item);
    if (!item.vendorId) res.errors.push("Processor missing required 'vendorId'.");
    if (!item.architecture) res.errors.push("Processor missing required 'architecture'.");
    if (!item.registerWidth || ![32, 64].includes(item.registerWidth)) {
      res.errors.push("Processor 'registerWidth' must be 32 or 64.");
    }
    res.valid = res.errors.length === 0;
    return res;
  }
}

export class PeripheralRegistry extends BaseRegistry<PeripheralEntity> {
  public readonly name = 'PeripheralRegistry';

  public override validate(item: PeripheralEntity): ValidationResult {
    const res = super.validate(item);
    if (!item.category) res.errors.push("Peripheral missing required 'category'.");
    if (!item.vendorId) res.errors.push("Peripheral missing required 'vendorId'.");
    res.valid = res.errors.length === 0;
    return res;
  }
}

export class BoardRegistry extends BaseRegistry<BoardEntity> {
  public readonly name = 'BoardRegistry';

  public override validate(item: BoardEntity): ValidationResult {
    const res = super.validate(item);
    if (!item.vendorId) res.errors.push("Board missing required 'vendorId'.");
    if (!item.processorId) res.errors.push("Board missing required 'processorId'.");
    res.valid = res.errors.length === 0;
    return res;
  }
}

export class VendorRegistry extends BaseRegistry<VendorEntity> {
  public readonly name = 'VendorRegistry';

  public override validate(item: VendorEntity): ValidationResult {
    const res = super.validate(item);
    if (!Array.isArray(item.supportedArchitectures)) {
      res.errors.push("Vendor missing 'supportedArchitectures' array.");
    }
    res.valid = res.errors.length === 0;
    return res;
  }
}

export class ToolchainRegistry extends BaseRegistry<ToolchainEntity> {
  public readonly name = 'ToolchainRegistry';

  public override validate(item: ToolchainEntity): ValidationResult {
    const res = super.validate(item);
    if (!item.vendorId) res.errors.push("Toolchain missing required 'vendorId'.");
    if (!item.compilerBinary) res.errors.push("Toolchain missing required 'compilerBinary'.");
    res.valid = res.errors.length === 0;
    return res;
  }
}

export class RuleRegistry extends BaseRegistry<RuleEntity> {
  public readonly name = 'RuleRegistry';

  public override validate(item: RuleEntity): ValidationResult {
    const res = super.validate(item);
    if (!item.category) res.errors.push("Rule missing required 'category'.");
    if (!item.severity) res.errors.push("Rule missing required 'severity'.");
    res.valid = res.errors.length === 0;
    return res;
  }
}

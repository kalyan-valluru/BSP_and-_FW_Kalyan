import type { BspFile } from './templateEngine';
import type { HardwareKnowledgeLayer } from './hardwareKnowledgeLayer';
import type { HardwarePeripheral } from '../../frontend/src/types';

export interface CustomProcessorPlugin {
  name: string;
  architecture: string;
  vendor: string;
  defaultMemorySize: string;
}

export interface CustomValidationRule {
  id: string;
  name: string;
  validate(peripherals: HardwarePeripheral[]): { passed: boolean; detail: string };
}

export interface CustomGenerator {
  ipName: string;
  generate(peripheral: HardwarePeripheral, hkl: HardwareKnowledgeLayer): BspFile[];
}

class PluginRegistry {
  private processors: CustomProcessorPlugin[] = [];
  private validationRules: CustomValidationRule[] = [];
  private generators: CustomGenerator[] = [];

  registerProcessor(p: CustomProcessorPlugin) {
    this.processors.push(p);
  }

  registerValidationRule(r: CustomValidationRule) {
    this.validationRules.push(r);
  }

  registerGenerator(g: CustomGenerator) {
    this.generators.push(g);
  }

  getProcessors() {
    return this.processors;
  }

  getValidationRules() {
    return this.validationRules;
  }

  getGenerators() {
    return this.generators;
  }
}

export const pluginSDK = new PluginRegistry();

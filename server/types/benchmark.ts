/**
 * benchmark.ts — TypeScript interfaces for the Hardware Benchmark Dataset
 * & Continuous Evaluation Framework.
 */

// ── Board registry ────────────────────────────────────────────────────────────

export type BoardStatus = 'pending_review' | 'verified' | 'synthetic' | 'obsolete';

export interface BenchmarkBoard {
  id: string;
  vendor: string;
  boardName: string;
  processor: string;
  architecture: string;
  docVersion: string;
  sourceUrl: string;
  downloadDate: string;
  localDocPath: string;
  groundTruth: GroundTruth | null;
  status: BoardStatus;
  notes: string;
}

// ── Ground truth ──────────────────────────────────────────────────────────────

export interface GroundTruthPeripheral {
  peripheralBlock: string;
  baseAddress: string;
  driverName?: string;
  interruptNumber?: number | string | null;
  type?: string;
  _kb_ref_address?: string;
  _kb_ref_irq?: number | null;
  _address_verified?: boolean;
  _irq_verified?: boolean;
}

export interface GroundTruth {
  board_id: string;
  board_name: string;
  vendor: string;
  architecture: string;
  processor: string;
  review_status: 'pending_review' | 'verified' | 'synthetic';
  generated_at: string;
  hardware: {
    processor: string;
    architecture: string;
    clock_frequency: string;
    clock_sources: string[];
    memory_size: string;
    flash_type: string;
    interrupt_controller: string;
    peripheral_count: number;
    peripherals: GroundTruthPeripheral[];
  };
  validation?: Record<string, unknown>;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface BenchmarkMetrics {
  processor_detection: number;    // 0–100
  peripheral_detection: number;   // 0–100
  base_address_accuracy: number;  // 0–100
  irq_accuracy: number;           // 0–100
  clock_detection: number;        // 0–100
  driver_mapping: number;         // 0–100
  bsp_generation: number;         // 0–100
  dts_accuracy: number;           // 0–100
  tcl_accuracy: number;           // 0–100
  build_success: number;          // 0–100
  hallucination_rate: number;     // 0–100 (lower is better)
}

export const METRIC_LABELS: Record<keyof BenchmarkMetrics, string> = {
  processor_detection:   'Processor Detection',
  peripheral_detection:  'Peripheral Detection',
  base_address_accuracy: 'Base Address Accuracy',
  irq_accuracy:          'IRQ Accuracy',
  clock_detection:       'Clock Detection',
  driver_mapping:        'Driver Mapping',
  bsp_generation:        'BSP Generation',
  dts_accuracy:          'DTS Accuracy',
  tcl_accuracy:          'Vivado TCL Accuracy',
  build_success:         'Build Success Rate',
  hallucination_rate:    'Hallucination Rate',
};

// ── Per-board result ──────────────────────────────────────────────────────────

export interface BoardResult {
  board_id: string;
  board_name: string;
  vendor: string;
  processor: string;
  architecture: string;
  status: BoardStatus;
  metrics: BenchmarkMetrics;
  eqs: number;           // Engineering Quality Score 0–100
  issues: string[];
  suggestions: string[];
}

// ── Benchmark run ─────────────────────────────────────────────────────────────

export interface BenchmarkRun {
  run_id: string;
  run_time: string;       // ISO string
  total_boards: number;
  vendors_covered: number;
  board_results: BoardResult[];
  aggregate_metrics: BenchmarkMetrics;
  overall_eqs: number;
  hallucination_count: number;
}

export interface BenchmarkRunSummary {
  run_id: string;
  run_time: string;
  total_boards: number;
  overall_eqs: number;
  hallucination_count: number;
  aggregate_metrics: BenchmarkMetrics;
}

// ── Regression detection ──────────────────────────────────────────────────────

export interface RegressionItem {
  metric: keyof BenchmarkMetrics;
  delta: number;
}

export interface RegressionReport {
  previous_run_id: string | null;
  eqs_delta: number;
  deltas: Record<keyof BenchmarkMetrics, number>;
  regressions: RegressionItem[];
  improvements: RegressionItem[];
  has_regressions: boolean;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface EqsTrendPoint {
  run_id: string;
  run_time: string;
  eqs: number;
}

export interface DashboardStats {
  total_boards: number;
  vendors_covered: number;
  verified_boards: number;
  boards_pending: number;
  overall_eqs: number;
  hallucination_count: number;
  latest_metrics: Partial<BenchmarkMetrics>;
  eqs_trend: EqsTrendPoint[];
  total_runs: number;
  last_run_time: string | null;
  boards: BenchmarkBoard[];
}

// ── Add-board form ────────────────────────────────────────────────────────────

export interface AddBoardForm {
  vendor: string;
  boardName: string;
  processor: string;
  architecture: string;
  sourceUrl: string;
  docVersion: string;
  notes: string;
}

// ── Vendor options ────────────────────────────────────────────────────────────

export const VENDOR_OPTIONS = [
  'AMD/Xilinx',
  'NXP',
  'STMicroelectronics',
  'Texas Instruments',
  'Microchip',
  'Intel FPGA',
  'Raspberry Pi',
  'Broadcom',
  'Renesas',
  'Infineon',
  'Other',
] as const;

export const ARCHITECTURE_OPTIONS = [
  'Zynq-7000',
  'Zynq UltraScale+',
  'Versal',
  'MicroBlaze',
  'i.MX 8',
  'i.MX RT',
  'STM32H7',
  'STM32F4',
  'AM335x',
  'AM64x',
  'BCM2711',
  'BCM2835',
  'Cyclone V SoC',
  'Stratix 10 SoC',
  'PolarFire SoC',
  'Other',
] as const;

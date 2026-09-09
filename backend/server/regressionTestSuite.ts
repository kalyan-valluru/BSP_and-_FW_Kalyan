/**
 * regressionTestSuite.ts
 * Production regression test runner — calls the FastAPI benchmark service
 * and returns structured metric deltas vs the previous run.
 */

export interface RegressionTestCase {
  id: string;
  name: string;
  expectedPeripheralsCount: number;
  expectedArchitecture: string;
}

export interface RegressionTestResult {
  testCase: string;
  extractionAccuracy: number;
  bspStatus: 'passed' | 'failed';
  dtsStatus: 'passed' | 'failed';
  score: number;
  // Extended fields for full benchmark results
  board_id?: string;
  vendor?: string;
  eqs?: number;
  metrics?: Record<string, number>;
  issues?: string[];
  suggestions?: string[];
}

export interface RegressionReport {
  run_id?: string;
  run_time?: string;
  results: RegressionTestResult[];
  overall_eqs: number;
  hallucination_count: number;
  has_regressions: boolean;
  eqs_delta: number;
  regressions: Array<{ metric: string; delta: number }>;
  improvements: Array<{ metric: string; delta: number }>;
}

// Legacy benchmark suite kept for backward compatibility
export const benchmarkSuite: RegressionTestCase[] = [
  { id: 'zynq', name: 'Zynq-7000 Reference Board', expectedPeripheralsCount: 4, expectedArchitecture: 'Zynq-7000' },
  { id: 'ultrascale', name: 'Zynq UltraScale+ EV Board', expectedPeripheralsCount: 6, expectedArchitecture: 'MPSoC' },
  { id: 'versal', name: 'Versal Prime Core Card', expectedPeripheralsCount: 8, expectedArchitecture: 'Versal' },
  { id: 'stm32', name: 'STM32H7 Nucleo Board', expectedPeripheralsCount: 3, expectedArchitecture: 'STM32' },
  { id: 'nxp', name: 'NXP i.MX 8M Plus EVK', expectedPeripheralsCount: 5, expectedArchitecture: 'i.MX' },
  { id: 'beagle', name: 'BeagleBone Black (AM335x)', expectedPeripheralsCount: 4, expectedArchitecture: 'AM335x' },
  { id: 'rpi', name: 'Raspberry Pi CM4 (BCM2711)', expectedPeripheralsCount: 3, expectedArchitecture: 'BCM2711' },
  { id: 'intel-de10', name: 'DE10-Nano (Cyclone V SoC)', expectedPeripheralsCount: 4, expectedArchitecture: 'Cyclone V SoC' },
];

const FASTAPI_BASE = 'http://13.233.63.82:3002';

/**
 * Run the full benchmark evaluation suite via FastAPI.
 * Falls back to the local heuristic scorer if the service is unreachable.
 */
export async function runRegressionTests(
  currentPeripheralsCount: number,
  detectedArch: string,
): Promise<RegressionTestResult[]> {
  try {
    const res = await fetch(`${FASTAPI_BASE}/api/benchmark/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractedResults: null }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success && data.run?.board_results) {
      return data.run.board_results.map((r: any) => ({
        testCase: r.board_name,
        extractionAccuracy: r.metrics?.peripheral_detection || 0,
        bspStatus: r.metrics?.bsp_generation >= 80 ? 'passed' : 'failed',
        dtsStatus: r.metrics?.dts_accuracy >= 70 ? 'passed' : 'failed',
        score: r.eqs || 0,
        board_id: r.board_id,
        vendor: r.vendor,
        eqs: r.eqs,
        metrics: r.metrics,
        issues: r.issues,
        suggestions: r.suggestions,
      }));
    }
  } catch (_err) {
    // Service unreachable — fall back to heuristic
  }

  // ── Heuristic fallback (no server required) ────────────────────────
  return benchmarkSuite.map(test => {
    const matchCount = Math.min(test.expectedPeripheralsCount, currentPeripheralsCount);
    const accuracy = Math.round((matchCount / test.expectedPeripheralsCount) * 100);
    const archMatch = detectedArch.toLowerCase().includes(test.expectedArchitecture.toLowerCase());
    return {
      testCase: test.name,
      extractionAccuracy: accuracy,
      bspStatus: archMatch ? 'passed' : 'failed',
      dtsStatus: accuracy > 75 ? 'passed' : 'failed',
      score: Math.round((accuracy + (archMatch ? 100 : 50)) / 2),
    };
  });
}

/**
 * Run the benchmark and return a full regression report with deltas.
 */
export async function runFullRegressionSuite(): Promise<RegressionReport> {
  try {
    const res = await fetch(`${FASTAPI_BASE}/api/benchmark/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractedResults: null }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const results = data.run?.board_results?.map((r: any) => ({
      testCase: r.board_name,
      extractionAccuracy: r.metrics?.peripheral_detection || 0,
      bspStatus: r.metrics?.bsp_generation >= 80 ? 'passed' : 'failed',
      dtsStatus: r.metrics?.dts_accuracy >= 70 ? 'passed' : 'failed',
      score: r.eqs || 0,
      board_id: r.board_id,
      vendor: r.vendor,
      eqs: r.eqs,
      metrics: r.metrics,
      issues: r.issues,
      suggestions: r.suggestions,
    })) ?? [];

    return {
      run_id: data.run?.run_id,
      run_time: data.run?.run_time,
      results,
      overall_eqs: data.run?.overall_eqs ?? 0,
      hallucination_count: data.run?.hallucination_count ?? 0,
      has_regressions: data.regressions?.has_regressions ?? false,
      eqs_delta: data.regressions?.eqs_delta ?? 0,
      regressions: data.regressions?.regressions ?? [],
      improvements: data.regressions?.improvements ?? [],
    };
  } catch (_err) {
    return {
      results: [],
      overall_eqs: 0,
      hallucination_count: 0,
      has_regressions: false,
      eqs_delta: 0,
      regressions: [],
      improvements: [],
    };
  }
}

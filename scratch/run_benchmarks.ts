import { detectBoardConfig } from '../server/knowledge_repo';
import { ToolchainRegistry } from '../server/toolchainRegistry';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

async function executeBenchmarks() {
  console.log('=== RUNNING PERFORMANCE BENCHMARKS ===\n');
  const metrics: Record<string, any> = {};

  // 1. Board Detection Speed
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    detectBoardConfig('zynqmp', 'Zynq MPSoC');
  }
  metrics.board_detection_time_ms = (Date.now() - t0) / 1000;
  console.log(`Board Detection Time (Avg over 1000 runs): ${metrics.board_detection_time_ms} ms`);

  // 2. Toolchain Discovery Latency
  const t1 = Date.now();
  await ToolchainRegistry.discoverAll();
  metrics.toolchain_discovery_time_ms = Date.now() - t1;
  console.log(`Toolchain Discovery Latency: ${metrics.toolchain_discovery_time_ms} ms`);

  // 3. RAG Retrieval Latency
  const t2 = Date.now();
  const pythonExe = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
  let matchCount = 0;
  try {
    const output = execSync(
      `"${pythonExe}" -c "import sys; sys.path.append('server'); from semantic_retriever import retriever; print(len(retriever.query('UART base address mapping', 3)))"`,
      { encoding: 'utf-8' }
    ).trim();
    matchCount = parseInt(output, 10) || 0;
  } catch (err: any) {
    console.warn(`[WARN] Python RAG query returned error: ${err.message}`);
  }
  metrics.rag_retrieval_latency_ms = Date.now() - t2;
  console.log(`RAG Retrieval Latency: ${metrics.rag_retrieval_latency_ms} ms (Found ${matchCount} matches)`);

  // 4. Memory Footprint
  const mem = process.memoryUsage();
  metrics.memory_rss_mb = Math.round(mem.rss / 1024 / 1024);
  metrics.memory_heap_used_mb = Math.round(mem.heapUsed / 1024 / 1024);
  console.log(`Node Memory RSS: ${metrics.memory_rss_mb} MB | Heap Used: ${metrics.memory_heap_used_mb} MB`);

  // Export results
  const reportPath = path.join(process.cwd(), 'reports', 'benchmarks.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(metrics, null, 2));
  console.log(`\nMetrics exported successfully to ${reportPath}`);
  process.exit(0);
}

executeBenchmarks();

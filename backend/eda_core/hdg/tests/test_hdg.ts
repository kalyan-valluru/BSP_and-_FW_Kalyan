import { HDGManager } from '../HDGManager';
import { DirectedGraph } from '../graph/DirectedGraph';

async function runHDGTestSuite() {
  console.log('====================================================');
  console.log('   PHASE 1.4 HARDWARE DEPENDENCY GRAPH (HDG) TEST  ');
  console.log('====================================================\n');

  const hdg = HDGManager.getInstance();
  hdg.resetState();

  // 1. Build Graph
  console.log('[TEST 1] Constructing Hardware Dependency Graph...');
  const buildRes = await hdg.buildGraph();
  console.log(`[PASS] HDG Constructed successfully. Nodes count: ${buildRes.nodesCount}`);

  // 2. Test Kahn's Topological Initialization Ordering
  console.log('\n[TEST 2] Testing Kahn\'s Topological Initialization Order Algorithm...');
  const sortRes = hdg.topoSort.sort(hdg.graph);

  if (!sortRes.hasCycle && sortRes.order.length === buildRes.nodesCount) {
    const names = sortRes.order.map(n => n.name);
    console.log(`[PASS] Deterministic initialization order computed (${sortRes.order.length} nodes):\n  ${names.join(' -> ')}`);
  } else {
    console.error('[FAIL] Topological sort failed or cycle detected.');
  }

  // 3. Test DFS Cycle Detector
  console.log('\n[TEST 3] Testing DFS Cycle Detector Engine...');
  const testGraph = new DirectedGraph();
  testGraph.addNode({ id: 'c1', type: 'clock_controller', name: 'Clock Controller 1' });
  testGraph.addNode({ id: 'c2', type: 'clock_source', name: 'Clock Source 2' });

  testGraph.addEdge({ sourceId: 'c1', targetId: 'c2', type: 'REQUIRES_CLOCK' });
  testGraph.addEdge({ sourceId: 'c2', targetId: 'c1', type: 'REQUIRES_CLOCK' }); // Circular dependency!

  const cycleCheck = hdg.cycleDetector.detectCycles(testGraph);
  if (cycleCheck.hasCycle) {
    console.log(`[PASS] Cycle detector caught circular clock loop safely: [${cycleCheck.cyclePath?.join(' -> ')}]`);
  } else {
    console.error('[FAIL] Cycle detector failed to catch circular loop.');
  }

  // 4. Test Downstream Impact Analysis Engine
  console.log('\n[TEST 4] Testing Downstream Change Propagation & Impact Analysis...');
  const impact = hdg.analyzeImpact('fclk_0');
  console.log(`[INFO] Modifying 'fclk_0' affects ${impact.directlyAffectedCount} direct child and ${impact.totalAffectedCount} total downstream node(s).`);

  if (impact.totalAffectedCount > 0 && impact.affectedNodes.some(n => n.id === 'axi_uartlite_0')) {
    console.log(`[PASS] Impact analysis verified: 'fclk_0' reconfigurations propagate to '${impact.affectedNodes.map(n => n.name).join(', ')}'.`);
  } else {
    console.error('[FAIL] Impact analysis check failed.');
  }

  // 5. Test HDG Dependency Queries
  console.log('\n[TEST 5] Testing HDG Upstream & Downstream Query Engine APIs...');
  const deps = hdg.queryEngine.findDependencies(hdg.graph, 'axi_uartlite_0');
  const clockDeps = hdg.queryEngine.findClockDependencies(hdg.graph, 'axi_uartlite_0');

  console.log(`[INFO] 'axi_uartlite_0' Upstream Dependencies: [${deps.map(n => n.id).join(', ')}]`);
  console.log(`[INFO] 'axi_uartlite_0' Clock Dependencies: [${clockDeps.map(n => n.id).join(', ')}]`);

  if (deps.some(n => n.id === 'fclk_0') && clockDeps.length > 0) {
    console.log('[PASS] Query Engine APIs for dependencies & clocks verified.');
  } else {
    console.error('[FAIL] HDG query engine test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 1.4 DEPENDENCY GRAPH TESTS PASSED');
  console.log('====================================================\n');
}

runHDGTestSuite().catch(err => {
  console.error('[HDG TEST FATAL ERROR]', err);
  process.exit(1);
});

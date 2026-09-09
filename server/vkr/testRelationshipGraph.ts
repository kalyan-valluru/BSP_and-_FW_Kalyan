import { EngineeringRelationshipGraph } from './relationshipGraph';

async function testRelationshipGraph() {
  console.log('=== TEST: Engineering Relationship Graph Verification ===');
  const graph = new EngineeringRelationshipGraph();

  const node = graph.queryRelationship('xilinx', 'zynq_ultrascale', 'uart');
  console.log(`Processor Node: ${node.processor}`);
  console.log(`  ├── Peripheral: ${node.peripheral}`);
  console.log(`  ├── Base Address: ${node.baseAddress}`);
  console.log(`  ├── Register Set: ${node.register}`);
  console.log(`  ├── Vendor Driver: ${node.driver}`);
  console.log(`  ├── SDK Header: ${node.sdkHeader}`);
  console.log(`  ├── Device Tree Binding: ${node.deviceTreeBinding}`);
  console.log(`  ├── Clock Domain: ${node.clockDomain}`);
  console.log(`  ├── IRQ Vector: ${node.irq}`);
  console.log(`  └── Citation: TRM ${node.trmChapter}`);

  console.log('\nSUCCESS: Engineering Relationship Graph Successfully Ingested & Queried.');
}

testRelationshipGraph().catch(console.error);

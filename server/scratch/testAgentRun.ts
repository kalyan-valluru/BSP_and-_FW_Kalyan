async function testPipeline() {
  console.log('Sending test request to /api/pipeline/run...');
  const res = await fetch('http://13.233.63.82:3001/api/pipeline/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'test_session_123',
      processorName: 'ARM Cortex-A9',
      boardName: 'AMD Xilinx Zynq-7000',
      peripherals: []
    })
  });

  const data = await res.json();
  console.log('--- RESPONSE SUCCESS ---', data.success);
  console.log('--- LOGS EMITTED BY AGENTS ---');
  console.log(data.logs);
}

testPipeline().catch(console.error);

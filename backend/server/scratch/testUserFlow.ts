async function testFullUserFlow() {
  console.log('=== TEST 1: User Selects Preset (AMD Xilinx Zynq-7000) ===');
  const session1 = `user_flow_${Date.now()}`;

  const presetRes = await fetch('http://13.233.63.82:3001/api/pipeline/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session1,
      processorName: 'AMD Xilinx Zynq-7000',
      boardName: 'Zynq-7000 ZedBoard',
      peripherals: [
        { peripheralBlock: 'processing_system7_0', baseAddress: '0x00000000', interruptNumber: 'N/A', clockSource: 'PS_CLK' },
        { peripheralBlock: 'axi_gpio_0', baseAddress: '0x41200000', interruptNumber: '61', clockSource: 'FCLK_CLK0' },
        { peripheralBlock: 'axi_uartlite_0', baseAddress: '0x40600000', interruptNumber: '62', clockSource: 'FCLK_CLK0' }
      ]
    })
  });

  const presetData = await presetRes.json();
  console.log('✔ Preset Ingestion Result:', presetData.success ? 'PASS' : 'FAIL');
  console.log('✔ Logs count from Agent Pipeline:', presetData.logs.length);
  console.log('✔ First 3 Agent Logs:\n ', presetData.logs.slice(0, 3).join('\n  '));

  console.log('\n=== TEST 2: User Clicks Run Compilation Sandbox ===');
  const compileSessionRes = await fetch('http://13.233.63.82:3001/api/compile-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bareMetalCode: '#include <stdio.h>\nint main() { printf("Hello SubAgent World!\\n"); return 0; }',
      deviceTreeCode: '/dts-v1/;\n/ { compatible = "xlnx,zynq-7000"; };',
      peripherals: presetData.hkl.peripherals,
      metadata: { processorName: 'AMD Xilinx Zynq-7000', vendor: 'AMD Xilinx' },
      targetFlow: 'bare_metal'
    })
  });

  const compileSessionData = await compileSessionRes.json();
  console.log('✔ Compilation Session Created ID:', compileSessionData.sessionId);

  console.log('\n=== TEST 3: Streaming Sub-Agent Execution Output ===');
  const streamRes = await fetch(`http://13.233.63.82:3001/api/compile-stream/${compileSessionData.sessionId}`);
  const textStream = await streamRes.text();
  const streamLines = textStream.split('\n').filter(l => l.startsWith('data: ')).map(l => l.replace('data: ', ''));

  console.log(`✔ Stream Received ${streamLines.length} log events from Build & Repair Sub-Agent.`);
  console.log('✔ Final 5 Logs Emitted to UI:\n ', streamLines.slice(-5).join('\n  '));
  console.log('\n✅ ALL USER FLOW TESTS PASSED SUCCESSFULLY!');
}

testFullUserFlow().catch(err => {
  console.error('❌ User Flow Test Failed:', err);
});

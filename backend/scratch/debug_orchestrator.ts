import { runOrchestratedPipeline } from '../server/executionOrchestrator';

async function test() {
    await runOrchestratedPipeline(
        'xilinx-zynq-7000',
        'int main() { return 0; }',
        '',
        [{ id: '1', peripheralBlock: 'UART', type: 'UART', baseAddress: '0xE0001000' } as any],
        ['board.pdf'],
        'bare_metal',
        { boardName: 'ZCU104', memorySize: '2GB' } as any,
        (type, line) => console.log(`[${type}] ${line}`)
    );
}

test();

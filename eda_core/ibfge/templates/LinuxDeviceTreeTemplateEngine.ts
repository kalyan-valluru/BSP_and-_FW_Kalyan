import { ITemplateEngine } from './ITemplateEngine';

export class LinuxDeviceTreeTemplateEngine implements ITemplateEngine {
  public readonly id = 'template-linux-dts';
  public readonly name = 'Linux DeviceTree (.dts) Template Engine';
  public readonly supportedOS = ['linux'];

  public render(templateName: string, context: Record<string, any>): string {
    const procId = context.targetProcessorId || 'zynq-7000';
    const uartAddr = context.uartBaseAddress || '0x41200000';
    const irqNum = context.uartIrq || 61;

    return `/dts-v1/;
/ {
    #address-cells = <1>;
    #size-cells = <1>;
    model = "AMD Xilinx ${procId} Board";
    compatible = "xlnx,zynq-zed", "xlnx,zynq-7000";

    soc {
        #address-cells = <1>;
        #size-cells = <1>;
        ranges;

        serial@${uartAddr.replace('0x', '')} {
            compatible = "xlnx,axi-uartlite-1.0";
            reg = <${uartAddr} 0x1000>;
            interrupts = <${irqNum}>;
            clocks = <&clk_fclk0>;
            status = "okay";
        };
    };
};
`;
  }
}

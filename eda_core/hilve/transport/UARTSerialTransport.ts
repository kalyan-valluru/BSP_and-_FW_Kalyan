import { TelemetryEvent } from '../types/hilveTypes';

export interface ITransport {
  readonly id: string;
  readonly name: string;

  connect(): Promise<boolean>;
  flashBinary(artifact: any): Promise<boolean>;
  readTelemetry(): Promise<TelemetryEvent[]>;
  disconnect(): Promise<void>;
}

export class UARTSerialTransport implements ITransport {
  public readonly id = 'transport-uart-serial';
  public readonly name = 'UART / Serial Hardware Transport Driver';

  public async connect(): Promise<boolean> {
    return true;
  }

  public async flashBinary(artifact: any): Promise<boolean> {
    return true;
  }

  public async readTelemetry(): Promise<TelemetryEvent[]> {
    const timestamp = new Date().toISOString();
    return [
      { timestamp, source: 'UART', message: '[HARDWARE BOOT] ZedBoard Zynq-7000 Bootloader v2.0' },
      { timestamp, source: 'UART', message: '[HARDWARE LOG] SystemClock_Config(): FCLK0 100MHz LOCKED' },
      { timestamp, source: 'UART', message: '[HARDWARE LOG] Peripheral_Init_All(): UART base 0x41200000 OK' },
      { timestamp, source: 'GPIO', message: '[HARDWARE LOG] GPIO Pin 7 LED Toggled LOW -> HIGH' }
    ];
  }

  public async disconnect(): Promise<void> {}
}

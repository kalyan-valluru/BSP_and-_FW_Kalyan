import { useState, useEffect } from 'react';
import { Cpu, Terminal, CheckCircle2, Copy, Check, Play, RefreshCw, Wifi, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface HardwareConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBoard?: string;
  peripherals?: any[];
}

export function HardwareConnectModal({
  isOpen,
  onClose,
  selectedBoard = 'Raspberry Pi 4 / 5',
  peripherals = [],
}: HardwareConnectModalProps) {
  const [targetBoard, setTargetBoard] = useState(selectedBoard);
  const [ipAddress, setIpAddress] = useState('192.168.1.50');
  const [username, setUsername] = useState('pi');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Real network connection state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'disconnected'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // AI-generated commands state
  const [commands, setCommands] = useState<Array<{ title: string; cmd: string; desc: string }>>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);

  // Sync board name when prop updates
  useEffect(() => {
    if (selectedBoard) {
      setTargetBoard(selectedBoard);
    }
  }, [selectedBoard]);

  // Fetch AI dynamic instructions whenever target board, IP, or user changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchInstructions = async () => {
      setLoadingCommands(true);
      try {
        const res = await fetch('/api/hardware/instructions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardName: targetBoard,
            ipAddress,
            username,
            peripherals,
          }),
        });
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.steps) && data.steps.length > 0) {
          setCommands(data.steps);
        } else if (isMounted) {
          setFallbackCommands();
        }
      } catch (err) {
        if (isMounted) setFallbackCommands();
      } finally {
        if (isMounted) setLoadingCommands(false);
      }
    };

    fetchInstructions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetBoard, ipAddress, username]);

  const setFallbackCommands = () => {
    if (targetBoard.toLowerCase().includes('raspberry')) {
      setCommands([
        {
          title: '1. SSH Terminal Connection',
          cmd: `ssh ${username}@${ipAddress}`,
          desc: 'Connect to target Raspberry Pi Linux user-space terminal.',
        },
        {
          title: '2. Transfer Generated C Driver Source',
          cmd: `scp main.c ${username}@${ipAddress}:/home/${username}/`,
          desc: 'Deploy compiled or generated C firmware source code.',
        },
        {
          title: '3. Enable Serial Hardware Port (One-Time)',
          cmd: `sudo raspi-config nonint do_serial_hw 0`,
          desc: 'Enables /dev/serial0 UART hardware controller.',
        },
        {
          title: '4. Native Target Compilation',
          cmd: `gcc -Wall -O2 main.c -o rpi_bsp_demo`,
          desc: 'Compile executable directly on ARM Linux kernel environment.',
        },
        {
          title: '5. Execute Hardware Peripheral Driver',
          cmd: `sudo ./rpi_bsp_demo`,
          desc: 'Run binary with root hardware memory permissions.',
        },
      ]);
    } else if (targetBoard.toLowerCase().includes('zynq') || targetBoard.toLowerCase().includes('zedboard')) {
      setCommands([
        {
          title: '1. Verify USB JTAG / UART Bridge',
          cmd: `ls -l /dev/ttyUSB* /dev/ttyACM*`,
          desc: 'Detect Digilent FTDI JTAG serial device binding.',
        },
        {
          title: '2. Open Telemetry Debug Serial Console',
          cmd: `picocom -b 115200 /dev/ttyUSB1`,
          desc: 'Connect to 115200 baud stdout telemetry stream.',
        },
        {
          title: '3. Download Bitstream & Flash ELF via Vitis/XSDB',
          cmd: `xsdb -eval "connect; targets -set -filter {name =~ \\"*Cortex-A9*\\"}; fpga system.bit; dow firmware.elf; run"`,
          desc: 'Programs Zynq PL logic & loads Cortex-A9 executable into DDR.',
        },
      ]);
    } else {
      setCommands([
        {
          title: '1. Serial UART Terminal Connection',
          cmd: `minicom -D /dev/ttyUSB0 -b 115200`,
          desc: 'Connect to serial stdout debug stream.',
        },
        {
          title: '2. Program Hardware via ST-Link / OpenOCD',
          cmd: `openocd -f interface/stlink.cfg -f target/stm32h7x.cfg -c "program firmware.elf verify reset exit"`,
          desc: 'Flash micro-controller ROM memory.',
        },
      ]);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Real backend ICMP network ping verification
  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setStatusMessage('');
    try {
      const res = await fetch('/api/hardware/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, boardName: targetBoard }),
      });
      const data = await res.json();
      if (data.connected) {
        setConnectionStatus('connected');
        setStatusMessage(data.message);
      } else {
        setConnectionStatus('disconnected');
        setStatusMessage(data.message);
      }
    } catch (err: any) {
      setConnectionStatus('disconnected');
      setStatusMessage('Network ping check failed. Check local network routing or IP address.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect with Target Hardware Board"
      subtitle="AI-Generated Connection Instructions & Real Hardware Network Verification"
      icon={<Cpu className="w-5 h-5 text-neon-cyan animate-pulse" />}
      accentColor="text-neon-cyan"
      size="xl"
    >
      <div className="space-y-6">
        {/* Target Board Configuration Banner */}
        <div className="bg-obsidian-200/80 border border-border-grid rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-cyan/15 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-mono uppercase">Target Hardware Profile</p>
              <div className="flex items-center gap-2">
                <select
                  value={targetBoard}
                  onChange={(e) => {
                    setTargetBoard(e.target.value);
                    setConnectionStatus('idle');
                    setStatusMessage('');
                  }}
                  className="bg-obsidian border border-neon-cyan/40 text-neon-cyan font-bold text-sm rounded-lg px-3 py-1 outline-none font-mono"
                >
                  <option value="Raspberry Pi 4 / 5">Raspberry Pi 4 / 5 (Linux User-Space)</option>
                  <option value="ZedBoard Zynq-7000">Xilinx ZedBoard (Zynq-7000 JTAG/UART)</option>
                  <option value="STM32H7 Nucleo">STMicroelectronics STM32H7 (ST-Link)</option>
                  <option value="TI Sitara AM335x">TI Sitara AM335x (BeagleBone)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connectionStatus === 'connected' ? (
              <span className="px-3 py-1.5 rounded-lg bg-neon-emerald/20 border border-neon-emerald/40 text-neon-emerald text-xs font-mono font-bold flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" /> Hardware Online & Reachable
              </span>
            ) : connectionStatus === 'disconnected' ? (
              <button
                onClick={handleTestConnection}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-red-500/30 transition-all cursor-pointer"
              >
                <AlertCircle className="w-4 h-4" /> Board Offline (Retry)
              </button>
            ) : (
              <button
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
                className="px-3.5 py-2 bg-gradient-to-r from-neon-cyan to-blue-500 text-obsidian font-bold text-xs rounded-lg flex items-center gap-1.5 hover:shadow-neon-cyan transition-all cursor-pointer disabled:opacity-50"
              >
                {connectionStatus === 'testing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pinging Real IP...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Test Real Network Ping
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Real Status Message Banner */}
        {statusMessage && (
          <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
            connectionStatus === 'connected'
              ? 'bg-neon-emerald/10 border-neon-emerald/30 text-neon-emerald'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {connectionStatus === 'connected' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Target Network Configuration */}
        {targetBoard.toLowerCase().includes('raspberry') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-obsidian border border-border-grid rounded-xl p-3.5">
            <div>
              <label className="text-[11px] text-text-muted font-mono uppercase">Target IP Address</label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => {
                  setIpAddress(e.target.value);
                  setConnectionStatus('idle');
                }}
                className="w-full bg-obsidian-200 border border-border-grid rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:border-neon-cyan outline-none mt-1"
                placeholder="192.168.1.50"
              />
            </div>
            <div>
              <label className="text-[11px] text-text-muted font-mono uppercase">SSH Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-obsidian-200 border border-border-grid rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:border-neon-cyan outline-none mt-1"
                placeholder="pi"
              />
            </div>
          </div>
        )}

        {/* AI-Generated Command Execution Sequence */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neon-cyan" /> Board-Specific Hardware Connection Commands
            </h3>
            {loadingCommands ? (
              <span className="text-[11px] text-neon-cyan font-mono flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Synthesizing Board Instructions...
              </span>
            ) : (
              <span className="text-[11px] text-text-muted font-mono">Click code box to copy command</span>
            )}
          </div>

          <div className="space-y-2.5">
            {commands.map((item, idx) => (
              <div
                key={idx}
                className="bg-obsidian-200/90 border border-border-grid hover:border-neon-cyan/50 rounded-xl p-3.5 transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-text-primary font-mono">{item.title}</span>
                  <button
                    onClick={() => handleCopy(item.cmd, idx)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-obsidian border border-border-grid text-[10px] font-mono text-text-secondary hover:text-neon-cyan hover:border-neon-cyan transition-all cursor-pointer"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3 h-3 text-neon-emerald" />
                        <span className="text-neon-emerald font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-text-muted mb-2 font-sans">{item.desc}</p>
                <div className="bg-obsidian p-2.5 rounded-lg border border-border-grid/80 font-mono text-xs text-neon-cyan flex items-center justify-between overflow-x-auto select-all">
                  <code>$ {item.cmd}</code>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Informational Footer */}
        <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl flex items-start gap-2.5 text-xs text-text-secondary">
          <ShieldCheck className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Ensure your target hardware is powered and connected to your local network or host USB JTAG bridge before executing the terminal commands.
          </p>
        </div>
      </div>
    </Modal>
  );
}

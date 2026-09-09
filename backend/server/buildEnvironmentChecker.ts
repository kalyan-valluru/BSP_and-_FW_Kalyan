import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface ToolStatus {
  name: string;
  path: string;
  found: boolean;
  version?: string;
  required: boolean;
  status?: string;
}

export interface EnvironmentReport {
  valid: boolean;
  tools: ToolStatus[];
  amdBase?: string;
  toolchainDetails?: any;
  errors: string[];
  warnings: string[];
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic AMD/Xilinx tool detection
// Searches common install roots and uses the first valid installation found.
// ─────────────────────────────────────────────────────────────────────────────

const AMD_SEARCH_ROOTS = [
  'C:\\AMDDesignTools',
  'C:\\AMDDesignTools\\2025.2',
  'C:\\AMD',
  'C:\\Xilinx',
  'D:\\AMD',
  'D:\\Xilinx',
];

const AMD_TOOL_RELATIVE: Record<string, string> = {
  vivado:     'Vivado\\bin\\vivado.bat',
  vitis:      'Vitis\\bin\\vitis.bat',
  xsct:       'Vitis\\bin\\xsct.bat',
  gccAarch32: 'Vitis\\gnu\\aarch32\\nt\\gcc-arm-none-eabi\\bin\\arm-none-eabi-gcc.exe',
  gccAarch64: 'Vitis\\gnu\\aarch64\\nt\\aarch64-none\\bin\\aarch64-none-elf-gcc.exe',
  make:       'Vitis\\gnuwin\\bin\\make.exe',
  dtc:        'Vitis\\bin\\dtc.exe',
};

/**
 * Dynamically resolves AMD/Xilinx tool paths by scanning known install roots
 * (C:\AMD\, C:\Xilinx\, etc.) or checking environment variables.
 * If multiple version folders exist, the newest version is automatically selected.
 */
export async function detectAMDBase(): Promise<string | null> {
  const envAmdBase = process.env.AMD_BASE || process.env.XILINX_VIVADO;
  if (envAmdBase) {
    try {
      const vivadoPath = path.join(envAmdBase, AMD_TOOL_RELATIVE.vivado);
      await fs.access(vivadoPath);
      return envAmdBase;
    } catch {
      try {
        const entries = await fs.readdir(envAmdBase, { withFileTypes: true });
        const versions = entries
          .filter(e => e.isDirectory() && /^\d{4}\.\d+$/.test(e.name))
          .map(e => e.name)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); // newest first
        for (const version of versions) {
          const candidate = path.join(envAmdBase, version);
          const vivadoCandidate = path.join(candidate, AMD_TOOL_RELATIVE.vivado);
          await fs.access(vivadoCandidate);
          return candidate;
        }
      } catch {}
    }
  }

  for (const root of AMD_SEARCH_ROOTS) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      // Find version directories (e.g. "2025.2", "2024.2")
      const versions = entries
        .filter(e => e.isDirectory() && /^\d{4}\.\d+$/.test(e.name))
        .map(e => e.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); // newest first

      for (const version of versions) {
        const candidate = path.join(root, version);
        // Confirm Vivado is present as a minimum signal
        const vivadoCandidate = path.join(candidate, AMD_TOOL_RELATIVE.vivado);
        try {
          await fs.access(vivadoCandidate);
          return candidate; // Found valid AMD base with newest version
        } catch { /* try next */ }
      }
    } catch { /* root doesn't exist */ }
  }
  return null;
}

// Resolved tool paths (populated at runtime by checkBuildEnvironment)
export let TOOL_PATHS: Record<string, string> = {};

async function getVersion(
  exePath: string,
  args: string[],
  pattern: RegExp
): Promise<string | undefined> {
  return new Promise(resolve => {
    try {
      const isWin = process.platform === 'win32';
      const cmd = isWin ? 'cmd.exe' : exePath;
      const cmdArgs = isWin ? ['/c', exePath, ...args] : args;
      const proc = spawn(cmd, cmdArgs, { shell: false });
      let out = '';
      proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { out += d.toString(); });
      proc.on('close', () => { const m = out.match(pattern); resolve(m ? m[1] : undefined); });
      proc.on('error', () => resolve(undefined));
      setTimeout(() => { proc.kill(); resolve(undefined); }, 15000);
    } catch { resolve(undefined); }
  });
}

async function resolveExecutablePath(p: string): Promise<{ found: boolean; resolvedPath: string }> {
  if (!p) return { found: false, resolvedPath: '' };
  
  // 1. Direct file check if absolute or relative file path or explicit configured path
  try {
    await fs.access(p);
    return { found: true, resolvedPath: p };
  } catch {}

  // 2. Command resolution via where.exe on Windows
  if (process.platform === 'win32') {
    try {
      const res = spawnSync('where.exe', [p], { encoding: 'utf-8', shell: false });
      if (res.status === 0 && res.stdout) {
        const firstPath = res.stdout.split(/\r?\n/)[0].trim();
        if (firstPath) {
          try {
            await fs.access(firstPath);
            return { found: true, resolvedPath: firstPath };
          } catch {}
        }
      }
    } catch {}
  }

  // 3. Process environment PATH directory scanning
  if (process.env.PATH) {
    const pathDirs = process.env.PATH.split(path.delimiter);
    const exeName = process.platform === 'win32' && !p.toLowerCase().endsWith('.exe') ? `${p}.exe` : p;
    for (const dir of pathDirs) {
      if (!dir) continue;
      const candidate = path.join(dir.trim(), exeName);
      try {
        await fs.access(candidate);
        return { found: true, resolvedPath: candidate };
      } catch {}
    }
  }

  // 4. Known Windows fallback paths (fallback only)
  if (p === 'gcc' || p.toLowerCase() === 'gcc.exe') {
    const knownHostGccPaths = [
      'C:\\msys64\\ucrt64\\bin\\gcc.exe',
      'C:\\msys64\\mingw64\\bin\\gcc.exe',
      'C:\\MinGW\\bin\\gcc.exe',
      'C:\\TDM-GCC-64\\bin\\gcc.exe'
    ];
    for (const knownPath of knownHostGccPaths) {
      try {
        await fs.access(knownPath);
        return { found: true, resolvedPath: knownPath };
      } catch {}
    }
  }

  return { found: false, resolvedPath: p };
}

export async function checkBuildEnvironment(
  targetArchitecture?: string,
  targetProcessor?: string
): Promise<EnvironmentReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tools: ToolStatus[] = [];

  const archLower = (targetArchitecture || 'arm').toLowerCase();
  const procLower = (targetProcessor || 'zynq-7000').toLowerCase();
  const isZynqOrArm = !procLower.includes('riscv') && !archLower.includes('riscv') && !archLower.includes('risc-v');
  const isRiscvTarget = archLower.includes('riscv') || archLower.includes('risc-v') || procLower.includes('riscv');

  console.log('[ENV CHECK] process.env.PATH:', process.env.PATH || 'N/A');

  // Step 1: Dynamically locate the AMD base directory
  const amdBase = await detectAMDBase();

  if (!amdBase) {
    const hasOverrides = ['VIVADO_PATH', 'VITIS_PATH', 'XSCT_PATH'].every(k => !!process.env[k]);
    if (!hasOverrides) {
      warnings.push(
        `Native AMD/Xilinx Vivado/Vitis tools not found in C:\\AMD, C:\\Xilinx, D:\\AMD, D:\\Xilinx.`
      );
    }
  }

  // Populate resolved TOOL_PATHS with absolute paths
  for (const [key, rel] of Object.entries(AMD_TOOL_RELATIVE)) {
    const envOverrideKey = `${key.toUpperCase()}_PATH`;
    if (process.env[envOverrideKey]) {
      TOOL_PATHS[key] = process.env[envOverrideKey]!;
    } else if (amdBase) {
      TOOL_PATHS[key] = path.join(amdBase, rel);
    } else {
      TOOL_PATHS[key] = '';
    }
  }

  // Dynamic PATH and Environment Variable Cross-Compiler Discovery
  TOOL_PATHS.gccAarch32 = process.env.ARM_NONE_EABI_GCC || TOOL_PATHS.gccAarch32 || 'arm-none-eabi-gcc';
  TOOL_PATHS.gccAarch64 = process.env.AARCH64_GCC || TOOL_PATHS.gccAarch64 || 'aarch64-linux-gnu-gcc';
  TOOL_PATHS.gccArmLinux = process.env.ARM_LINUX_GNUEABIHF_GCC || 'arm-linux-gnueabihf-gcc';
  TOOL_PATHS.gccRiscv   = process.env.RISCV_GCC || 'riscv64-unknown-elf-gcc';
  TOOL_PATHS.gccHost    = process.env.GCC || 'gcc';
  TOOL_PATHS.dtc        = process.env.DTC_PATH || TOOL_PATHS.dtc || 'dtc';

  // Verify each tool
  const toolDefs: Array<{ key: string; name: string; required: boolean; isTargetRelevant: boolean; versionArgs?: string[]; versionPattern?: RegExp }> = [
    { key: 'vivado',     name: 'Vivado',                    required: false, isTargetRelevant: true, versionArgs: ['-version'], versionPattern: /vivado v([\d.]+)/i },
    { key: 'vitis',      name: 'Vitis',                     required: false, isTargetRelevant: true },
    { key: 'xsct',       name: 'XSCT (Vitis)',               required: false, isTargetRelevant: true },
    { key: 'gccAarch32', name: 'arm-none-eabi-gcc (ARM 32-bit Cortex-M/R)', required: false, isTargetRelevant: isZynqOrArm || (!isRiscvTarget), versionArgs: ['--version'], versionPattern: /gcc.*?([\d]+\.[\d]+\.[\d]+)/i },
    { key: 'gccAarch64', name: 'aarch64-linux-gnu-gcc (ARM 64-bit Cortex-A)', required: false, isTargetRelevant: isZynqOrArm, versionArgs: ['--version'], versionPattern: /gcc.*?([\d]+\.[\d]+\.[\d]+)/i },
    { key: 'gccRiscv',   name: 'riscv64-unknown-elf-gcc (RISC-V)', required: false, isTargetRelevant: isRiscvTarget, versionArgs: ['--version'], versionPattern: /gcc.*?([\d]+\.[\d]+\.[\d]+)/i },
    { key: 'gccHost',    name: 'gcc (x86 / Host GCC)',      required: false, isTargetRelevant: true, versionArgs: ['--version'], versionPattern: /gcc.*?([\d]+\.[\d]+\.[\d]+)/i },
    { key: 'make',       name: 'Make',                      required: false, isTargetRelevant: true },
    { key: 'dtc',        name: 'Device Tree Compiler (dtc)', required: false, isTargetRelevant: true, versionArgs: ['--version'], versionPattern: /Version:\s*DTC\s*([\d.]+)/i },
  ];

  for (const def of toolDefs) {
    const rawPath = TOOL_PATHS[def.key];
    const { found: fileIsFound, resolvedPath } = await resolveExecutablePath(rawPath);
    let found = fileIsFound;
    let version: string | undefined;

    const queryPath = resolvedPath || rawPath || def.key;
    if (def.versionArgs && def.versionPattern) {
      version = await getVersion(queryPath, def.versionArgs, def.versionPattern);
      if (version) {
        found = true;
      }
    }

    if (found && resolvedPath) {
      TOOL_PATHS[def.key] = resolvedPath;
    }

    if (def.key === 'gccHost') {
      console.log('[ENV CHECK] Resolved Host GCC path:', resolvedPath || rawPath || 'Not found');
    }

    if (!def.isTargetRelevant) {
      tools.push({
        name: def.name,
        path: resolvedPath || rawPath || def.name,
        found: false,
        required: false,
        status: 'NOT_APPLICABLE'
      });
    } else {
      tools.push({
        name: def.name,
        path: resolvedPath || rawPath || def.name,
        found,
        version,
        required: def.required,
        status: found ? (version ? `v${version}` : 'FOUND') : 'NOT_FOUND'
      });

      if (!found) {
        const msg = `${def.name} not detected at ${resolvedPath || rawPath || 'PATH'}. To enable target cross-compilation, install ${def.name}.`;
        warnings.push(msg);
      }
    }
  }

  return {
    valid: errors.length === 0,
    tools,
    amdBase,
    errors,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

export function formatEnvironmentReportHTML(report: EnvironmentReport): string {
  const icon = (t: ToolStatus) => t.found ? '✅' : t.required ? '❌' : '⚠️';
  const rows = report.tools.map(t => `
    <tr style="background:${t.found ? '#1a2a1a' : t.required ? '#2a1a1a' : '#2a2a1a'}">
      <td style="padding:8px 12px">${icon(t)} ${t.name}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#aaa">${t.path}</td>
      <td style="padding:8px 12px;color:${t.found ? '#4caf50' : '#f44336'}">${t.found ? (t.version || 'Detected') : 'Not Found'}</td>
    </tr>`).join('');
  const errRows  = report.errors.map(e => `<li style="color:#f44336">${e}</li>`).join('');
  const warnRows = report.warnings.map(w => `<li style="color:#ff9800">${w}</li>`).join('');
  return `<!DOCTYPE html>
<html><head><title>Build Environment Report</title>
<style>body{background:#111;color:#eee;font-family:sans-serif;padding:24px}
table{border-collapse:collapse;width:100%}th{background:#222;padding:10px 12px;text-align:left}
td{border-bottom:1px solid #333}</style></head>
<body>
<h1>🔧 Build Environment Report</h1>
<p>Generated: ${report.timestamp}</p>
${report.amdBase ? `<p><strong>AMD Base:</strong> <code>${report.amdBase}</code></p>` : ''}
<p style="color:${report.valid ? '#4caf50' : '#f44336'};font-weight:bold;font-size:18px">
  ${report.valid ? '✅ Environment Valid' : '❌ Environment Invalid — Missing Required Tools'}
</p>
<table><thead><tr><th>Tool</th><th>Path</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
${report.errors.length ? `<h2 style="color:#f44336">Errors</h2><ul>${errRows}</ul>` : ''}
${report.warnings.length ? `<h2 style="color:#ff9800">Warnings</h2><ul>${warnRows}</ul>` : ''}
</body></html>`;
}

export function formatEnvironmentReportTXT(report: EnvironmentReport): string {
  const lines = [
    'BUILD ENVIRONMENT REPORT',
    '========================',
    `Generated : ${report.timestamp}`,
    `AMD Base  : ${report.amdBase || 'Not detected'}`,
    `Status    : ${report.valid ? 'VALID' : 'INVALID'}`,
    '', 'TOOLS', '-----',
  ];
  for (const t of report.tools) {
    const status = t.found ? `FOUND${t.version ? ' v' + t.version : ''}` : 'NOT FOUND';
    lines.push(`  ${t.required ? '[REQUIRED]' : '[OPTIONAL]'} ${t.name}`);
    lines.push(`    Path   : ${t.path}`);
    lines.push(`    Status : ${status}`);
  }
  if (report.errors.length)   { lines.push('', 'ERRORS',   '------'); report.errors.forEach(e => lines.push(`  - ${e}`)); }
  if (report.warnings.length) { lines.push('', 'WARNINGS', '--------'); report.warnings.forEach(w => lines.push(`  - ${w}`)); }
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Tier DTC (Device Tree Compiler) Resolution
// Order: 1. Native dtc | 2. Configured DTC_PATH | 3. WSL Ubuntu dtc | 4. Fail
// ─────────────────────────────────────────────────────────────────────────────

export interface DtcResolutionResult {
  type: 'native' | 'configured' | 'wsl' | 'unavailable';
  executable: string;
  version?: string;
  wslArgs?: string[];
  actionableError?: string;
}

export function toWslPath(winPath: string): string {
  const normalized = path.resolve(winPath).replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    const drive = normalized[0].toLowerCase();
    return `/mnt/${drive}/${normalized.substring(3)}`;
  }
  return normalized;
}

export async function resolveDtcTool(): Promise<DtcResolutionResult> {
  // 1. Native dtc in PATH
  try {
    const nativeRes = spawnSync('dtc', ['--version'], { encoding: 'utf-8', timeout: 5000 });
    if (nativeRes.status === 0 && nativeRes.stdout) {
      const match = nativeRes.stdout.match(/Version:\s*DTC\s*([\d.]+)/i) || nativeRes.stdout.match(/([\d.]+)/);
      return {
        type: 'native',
        executable: 'dtc',
        version: match ? match[1] : nativeRes.stdout.trim()
      };
    }
  } catch {}

  // 2. Configured DTC path
  const configuredPath = process.env.DTC_PATH || TOOL_PATHS.dtc;
  if (configuredPath && configuredPath !== 'dtc') {
    try {
      const cfgRes = spawnSync(configuredPath, ['--version'], { encoding: 'utf-8', timeout: 5000 });
      if (cfgRes.status === 0 && cfgRes.stdout) {
        const match = cfgRes.stdout.match(/Version:\s*DTC\s*([\d.]+)/i) || cfgRes.stdout.match(/([\d.]+)/);
        return {
          type: 'configured',
          executable: configuredPath,
          version: match ? match[1] : cfgRes.stdout.trim()
        };
      }
    } catch {}
  }

  // 3. WSL Ubuntu dtc
  try {
    const wslRes = spawnSync('wsl', ['dtc', '--version'], { encoding: 'utf-8', timeout: 5000 });
    if (wslRes.status === 0 && wslRes.stdout && !wslRes.stdout.includes('not installed')) {
      const match = wslRes.stdout.match(/Version:\s*DTC\s*([\d.]+)/i) || wslRes.stdout.match(/([\d.]+)/);
      return {
        type: 'wsl',
        executable: 'wsl',
        wslArgs: ['dtc'],
        version: match ? match[1] : wslRes.stdout.trim()
      };
    }
  } catch {}

  // 4. Fail with Actionable Error
  return {
    type: 'unavailable',
    executable: '',
    actionableError: `Linux Device Tree compilation cannot proceed because Device Tree Compiler (dtc) is unavailable.\n\nInstall DTC in WSL:\n\n  sudo apt update\n  sudo apt install device-tree-compiler\n\nThen restart the backend server.`
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// DTB Provenance Record
// Describes the real DTC compilation that produced a system.dtb.
// A DTB is only valid if this record was produced by an actual dtc execution.
// ─────────────────────────────────────────────────────────────────────────────

export interface DtbProvenance {
  artifact:        'dtb';
  path:            string;
  compiler:        'dtc';
  compilerSource:  'native' | 'configured' | 'wsl';
  compilerVersion: string | undefined;
  input:           string;
  output:          string;
  exitCode:        0;
  fileSize:        number;
  magicValid:      true;
  generatedAt:     string;
}

/**
 * Validates that a file on disk is a genuine Device Tree Blob by checking
 * the FDT magic bytes (0xd00dfeed) at offset 0.
 */
async function validateDtbMagic(dtbPath: string): Promise<{ valid: boolean; reason?: string }> {
  const FDT_MAGIC = 0xd00dfeed;
  try {
    const fd = await fs.open(dtbPath, 'r');
    try {
      const buf = Buffer.alloc(4);
      const { bytesRead } = await fd.read(buf, 0, 4, 0);
      if (bytesRead < 4) {
        return { valid: false, reason: 'DTB file too small to contain FDT header (< 4 bytes)' };
      }
      const magic = buf.readUInt32BE(0);
      if (magic !== FDT_MAGIC) {
        return {
          valid: false,
          reason: `FDT magic mismatch: expected 0x${FDT_MAGIC.toString(16).toUpperCase()}, got 0x${magic.toString(16).toUpperCase()}`
        };
      }
      return { valid: true };
    } finally {
      await fd.close();
    }
  } catch (err: any) {
    return { valid: false, reason: `Cannot read DTB for validation: ${err.message}` };
  }
}

export async function compileDeviceTree(
  dtsPath: string,
  dtbPath: string,
  onLog: (type: 'info' | 'error' | 'warning' | 'success', line: string) => void = () => {}
): Promise<{ success: boolean; error?: string; bytes?: number; resolution?: DtcResolutionResult; provenance?: DtbProvenance }> {
  onLog('info', '[LINUX TOOLCHAIN] Resolving Device Tree Compiler (DTC)...');
  const dtcResolution = await resolveDtcTool();

  // ─── HARD FAILURE: DTC unavailable ───────────────────────────────────────
  // PRODUCTION RULE: NO DTC = LINUX COMPILATION FAILED.
  // No synthetic DTB. No placeholder. No fallback.
  if (dtcResolution.type === 'unavailable') {
    onLog('error', '[LINUX TOOLCHAIN] Native DTC: NOT FOUND');
    onLog('error', '[LINUX TOOLCHAIN] Configured DTC: NOT FOUND');
    onLog('error', '[LINUX TOOLCHAIN] WSL DTC: NOT AVAILABLE');
    onLog('error', '[LINUX TOOLCHAIN] DTC resolution failed.');
    onLog('error', '[LINUX COMPILATION FAILED] Device Tree Compiler is required for Linux Device Tree compilation.');
    onLog('error', [
      '',
      '  Install DTC using WSL:',
      '',
      '    sudo apt update',
      '    sudo apt install device-tree-compiler',
      '',
      '  Then verify:',
      '',
      '    dtc --version',
      '',
    ].join('\n'));
    return {
      success: false,
      error: dtcResolution.actionableError || 'Device Tree Compiler (dtc) is required for Linux compilation but is not available.',
      resolution: dtcResolution
    };
  }

  if (dtcResolution.type === 'configured') {
    onLog('info', '[LINUX TOOLCHAIN] Native DTC: NOT FOUND');
    onLog('info', '[LINUX TOOLCHAIN] Configured DTC: FOUND');
    onLog('info', `[LINUX TOOLCHAIN] DTC executable: ${dtcResolution.executable}`);
    onLog('info', `[LINUX TOOLCHAIN] DTC version: ${dtcResolution.version || 'unknown'}`);
    onLog('info', `[LINUX TOOLCHAIN] DTC source: ${dtcResolution.type}`);
  } else if (dtcResolution.type === 'native') {
    onLog('info', '[LINUX TOOLCHAIN] Native DTC: FOUND');
    onLog('info', `[LINUX TOOLCHAIN] DTC executable: ${dtcResolution.executable}`);
    onLog('info', `[LINUX TOOLCHAIN] DTC version: ${dtcResolution.version || 'unknown'}`);
    onLog('info', `[LINUX TOOLCHAIN] DTC source: ${dtcResolution.type}`);
  } else if (dtcResolution.type === 'wsl') {
    onLog('info', '[LINUX TOOLCHAIN] Native DTC: NOT FOUND');
    onLog('info', '[LINUX TOOLCHAIN] Configured DTC: NOT FOUND');
    onLog('info', '[LINUX TOOLCHAIN] WSL DTC: FOUND');
    onLog('info', `[LINUX TOOLCHAIN] DTC executable: ${dtcResolution.executable}`);
    onLog('info', `[LINUX TOOLCHAIN] DTC version: ${dtcResolution.version || 'unknown'}`);
    onLog('info', `[LINUX TOOLCHAIN] DTC source: ${dtcResolution.type}`);
  }

  onLog('info', `[LINUX TOOLCHAIN] Compiling ${path.basename(dtsPath)} → ${path.basename(dtbPath)}`);

  return new Promise((resolve) => {
    const cmd = dtcResolution.executable;
    let args: string[] = [];

    if (dtcResolution.type === 'wsl') {
      const wslDts = toWslPath(dtsPath);
      const wslDtb = toWslPath(dtbPath);
      args = ['--', 'dtc', '-I', 'dts', '-O', 'dtb', wslDts, '-o', wslDtb];
    } else {
      args = ['-I', 'dts', '-O', 'dtb', dtsPath, '-o', dtbPath];
    }

    const proc = spawn(cmd, args, { shell: false });
    let stderrData = '';
    proc.stderr?.on('data', (d: Buffer) => { stderrData += d.toString(); });

    proc.on('close', async (code: number | null) => {
      // On Windows, code can be null when the process exits abnormally
      const exitCode = code ?? -1;

      if (exitCode !== 0) {
        const errStr = `DTC exited with exit code ${exitCode}${stderrData ? `. Stderr: ${stderrData.trim()}` : ''}.`;
        onLog('error', `[LINUX COMPILATION FAILED] ${errStr}`);
        resolve({ success: false, error: errStr, resolution: dtcResolution });
        return;
      }

      // DTC exited 0 — verify file exists with content
      let fileStat: { size: number } | null = null;
      try {
        fileStat = await fs.stat(dtbPath);
      } catch (e: any) {
        const errStr = `DTB output file missing after DTC exit 0: ${e.message}`;
        onLog('error', `[LINUX COMPILATION FAILED] ${errStr}`);
        resolve({ success: false, error: errStr, resolution: dtcResolution });
        return;
      }

      if (fileStat.size === 0) {
        const errStr = 'Generated DTB file is empty (0 bytes).';
        onLog('error', `[LINUX COMPILATION FAILED] ${errStr}`);
        resolve({ success: false, error: errStr, resolution: dtcResolution });
        return;
      }

      // Validate FDT magic bytes (0xd00dfeed) — proves real dtc output
      const magicCheck = await validateDtbMagic(dtbPath);
      if (!magicCheck.valid) {
        const errStr = `DTB validation failed: ${magicCheck.reason}`;
        onLog('error', `[LINUX COMPILATION FAILED] ${errStr}`);
        resolve({ success: false, error: errStr, resolution: dtcResolution });
        return;
      }

      // All checks passed — build provenance record
      const provenance: DtbProvenance = {
        artifact:        'dtb',
        path:            dtbPath,
        compiler:        'dtc',
        compilerSource:  dtcResolution.type as 'native' | 'configured' | 'wsl',
        compilerVersion: dtcResolution.version,
        input:           dtsPath,
        output:          dtbPath,
        exitCode:        0,
        fileSize:        fileStat.size,
        magicValid:      true,
        generatedAt:     new Date().toISOString(),
      };

      onLog('success', '[SUCCESS] Device Tree compilation completed.');
      onLog('success', '[SUCCESS] DTB exists.');
      onLog('success', `[SUCCESS] DTB size: ${fileStat.size} bytes.`);
      onLog('success', '[SUCCESS] DTB magic validation passed.');
      onLog('info',    `[DTB PROVENANCE] compiler=dtc source=${provenance.compilerSource} version=${provenance.compilerVersion || 'unknown'} exitCode=0 size=${fileStat.size} generatedAt=${provenance.generatedAt}`);

      resolve({ success: true, bytes: fileStat.size, resolution: dtcResolution, provenance });
    });

    proc.on('error', (err: any) => {
      // ─── HARD FAILURE: ENOENT / spawn error ──────────────────────────────
      // PRODUCTION RULE: If the resolved DTC binary cannot be executed,
      // the Linux compilation FAILS. No fallback. No synthetic DTB.
      const errStr = `Device Tree Compiler (dtc) executable failed to launch: ${err.message}. Ensure dtc is installed and accessible.`;
      onLog('error', `[LINUX COMPILATION FAILED] ${errStr}`);
      resolve({ success: false, error: errStr, resolution: dtcResolution });
    });
  });
}
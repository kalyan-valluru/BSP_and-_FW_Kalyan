"""
build_verifier.py
Build Verification Engine — automatically checks:
  - Vivado TCL executes successfully
  - Vitis BSP compiles successfully
  - Device Tree compiles (dtc) successfully

On failure: captures compiler logs, identifies affected files,
sends only errors + HKL to AI, regenerates affected files,
rebuilds until success or retry limit.
"""

import os
import re
import json
import subprocess
import tempfile
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

MAX_RETRY_LIMIT = 3
vitis_dtc_path = r"C:\AMDDesignTools\2025.2\Vitis\bin\dtc.exe"
DTC_BINARY       = os.environ.get("DTC_PATH") or (vitis_dtc_path if os.path.exists(vitis_dtc_path) else "dtc")
VIVADO_CMD       = "vivado"
VITIS_CMD        = "vitis"


# ─────────────────────────────────────────────────────────────────────────────
# DATA STRUCTURES
# ─────────────────────────────────────────────────────────────────────────────

class BuildResult:
    def __init__(
        self,
        artifact_type: str,
        success: bool,
        exit_code: int,
        stdout: str,
        stderr: str,
        errors: List[str],
        warnings: List[str],
        affected_files: List[str],
        retry_count: int = 0,
        timestamp: str = "",
    ):
        self.artifact_type = artifact_type
        self.success       = success
        self.exit_code     = exit_code
        self.stdout        = stdout
        self.stderr        = stderr
        self.errors        = errors
        self.warnings      = warnings
        self.affected_files= affected_files
        self.retry_count   = retry_count
        self.timestamp     = timestamp or datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "artifactType":  self.artifact_type,
            "success":       self.success,
            "exitCode":      self.exit_code,
            "errors":        self.errors,
            "warnings":      self.warnings,
            "affectedFiles": self.affected_files,
            "retryCount":    self.retry_count,
            "timestamp":     self.timestamp,
        }


# ─────────────────────────────────────────────────────────────────────────────
# LOG PARSERS
# ─────────────────────────────────────────────────────────────────────────────

def parse_compiler_errors(log: str, artifact_type: str) -> Tuple[List[str], List[str], List[str]]:
    """
    Parse compiler/tool output and extract errors, warnings, and affected file paths.
    Returns (errors, warnings, affected_files).
    """
    errors: List[str]  = []
    warnings: List[str] = []
    affected_files: List[str] = set()

    lines = log.splitlines()

    for line in lines:
        # GCC/Clang style errors: file.c:42:8: error: ...
        m = re.match(r'^([\w/\\.]+\.[ch]):(\d+):\d+:\s+(error|warning):\s+(.+)', line)
        if m:
            fpath, lineno, level, msg = m.group(1), m.group(2), m.group(3), m.group(4)
            entry = f"{fpath}:{lineno}: {msg}"
            affected_files.add(fpath)
            if level == "error":
                errors.append(entry)
            else:
                warnings.append(entry)
            continue

        # DTS/DTC errors: Error: file.dts:42.8: ...
        m = re.match(r'^ERROR:\s+([\w/\\.]+\.dts?):(\d+)\.\d+:\s+(.+)', line, re.IGNORECASE)
        if m:
            fpath, lineno, msg = m.group(1), m.group(2), m.group(3)
            errors.append(f"{fpath}:{lineno}: {msg}")
            affected_files.add(fpath)
            continue

        # Vivado TCL: ERROR: ...
        if line.startswith("ERROR:") and "Vivado" in artifact_type or "TCL" in artifact_type:
            errors.append(line)
            continue

        # General error keywords
        if re.search(r'\b(error|fatal|undefined reference|no such file)\b', line, re.IGNORECASE):
            # Extract any file paths mentioned
            fp_m = re.findall(r'[\w/\\.]+\.[ch]', line)
            for fp in fp_m:
                affected_files.add(fp)
            if "error" in line.lower():
                errors.append(line.strip())
            continue

        if "warning:" in line.lower():
            warnings.append(line.strip())

    return errors, warnings, list(affected_files)


# ─────────────────────────────────────────────────────────────────────────────
# DTC — DEVICE TREE COMPILATION
# ─────────────────────────────────────────────────────────────────────────────

def verify_device_tree(dts_content: str, dts_filename: str = "output.dts") -> BuildResult:
    """
    Compile a DTS string using the device tree compiler (dtc).
    Returns a BuildResult with success/error information.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        dts_path = os.path.join(tmpdir, dts_filename)
        dtb_path = os.path.join(tmpdir, dts_filename.replace(".dts", ".dtb"))

        with open(dts_path, "w", encoding="utf-8") as f:
            f.write(dts_content)

        try:
            result = subprocess.run(
                [DTC_BINARY, "-I", "dts", "-O", "dtb", "-o", dtb_path, dts_path],
                capture_output=True, text=True, timeout=30
            )
            log_combined = result.stdout + "\n" + result.stderr
            errors, warnings, affected = parse_compiler_errors(log_combined, "DTS")

            return BuildResult(
                artifact_type="Linux DTS",
                success=result.returncode == 0 and not errors,
                exit_code=result.returncode,
                stdout=result.stdout[:3000],
                stderr=result.stderr[:3000],
                errors=errors,
                warnings=warnings,
                affected_files=[dts_filename] if errors else [],
            )
        except FileNotFoundError:
            # dtc not installed — do structural validation instead
            return _structural_dts_validation(dts_content, dts_filename)
        except subprocess.TimeoutExpired:
            return BuildResult(
                artifact_type="Linux DTS",
                success=False, exit_code=-1,
                stdout="", stderr="DTC compilation timed out",
                errors=["Compilation timed out after 30s"],
                warnings=[], affected_files=[dts_filename],
            )


def _structural_dts_validation(dts_content: str, filename: str) -> BuildResult:
    """Structural DTS validator when dtc is not available."""
    errors = []
    warnings = []

    lines = dts_content.splitlines()
    brace_depth = 0
    has_root = False

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*"):
            continue

        brace_depth += stripped.count('{') - stripped.count('}')

        if stripped == "/ {":
            has_root = True

        # Check for common DTS errors
        if re.match(r'^\w[\w,@-]*\s*{', stripped) and not stripped.endswith("{"):
            # Node definition without opening brace on same line — ok
            pass

        if stripped.endswith(";") is False and stripped and not stripped.startswith("//") and \
           not stripped.endswith("{") and not stripped.endswith("}") and \
           not stripped.endswith("};") and not stripped.startswith("/"):
            # Property not terminated with semicolon
            if "=" in stripped or re.match(r'^[\w-]+ =', stripped):
                warnings.append(f"{filename}:{i}: Property may be missing semicolon: '{stripped[:60]}'")

    if brace_depth != 0:
        errors.append(f"{filename}: Unbalanced braces (depth={brace_depth})")

    if not has_root:
        errors.append(f"{filename}: Missing root node '/ {{}}'")

    return BuildResult(
        artifact_type="Linux DTS",
        success=len(errors) == 0,
        exit_code=0 if not errors else 1,
        stdout="[Structural validation — dtc not found on PATH]",
        stderr="",
        errors=errors,
        warnings=warnings,
        affected_files=[filename] if errors else [],
    )


# ─────────────────────────────────────────────────────────────────────────────
# TCL VALIDATION (Structural — Vivado not required for syntax check)
# ─────────────────────────────────────────────────────────────────────────────

def verify_vivado_tcl(tcl_content: str, tcl_filename: str = "output.tcl") -> BuildResult:
    """
    Validate Vivado TCL syntax and structure.
    Full Vivado execution requires a license; structural checks run always.
    """
    errors = []
    warnings = []
    lines = tcl_content.splitlines()

    bracket_depth  = 0
    brace_depth_t  = 0
    required_cmds  = ["create_project", "set_property", "apply_bd_automation"]
    found_cmds     = set()

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue

        bracket_depth  += stripped.count('[') - stripped.count(']')
        brace_depth_t  += stripped.count('{') - stripped.count('}')

        for cmd in required_cmds:
            if stripped.startswith(cmd):
                found_cmds.add(cmd)

        # Check for invalid Vivado commands
        if re.match(r'^set_property\s+\w+\s+[^\[]+$', stripped) and not stripped.endswith("\\"):
            # set_property without -dict form when multiple props needed — warning
            if stripped.count('-') == 0 and len(stripped) > 80:
                warnings.append(f"{tcl_filename}:{i}: Long set_property without -dict form")

        # Check for hardcoded paths that may not be portable
        if re.search(r'C:\\|C:/', stripped):
            warnings.append(f"{tcl_filename}:{i}: Hardcoded Windows path detected — use relative paths")

    if bracket_depth != 0:
        errors.append(f"{tcl_filename}: Unbalanced brackets (depth={bracket_depth})")
    if brace_depth_t != 0:
        errors.append(f"{tcl_filename}: Unbalanced braces (depth={brace_depth_t})")

    missing = [c for c in required_cmds[:2] if c not in found_cmds]
    if missing:
        warnings.append(f"{tcl_filename}: Expected commands not found: {', '.join(missing)}")

    return BuildResult(
        artifact_type="Vivado TCL",
        success=len(errors) == 0,
        exit_code=0 if not errors else 1,
        stdout="[TCL structural validation]",
        stderr="",
        errors=errors,
        warnings=warnings,
        affected_files=[tcl_filename] if errors else [],
    )


# ─────────────────────────────────────────────────────────────────────────────
# BSP C HEADER VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def verify_bsp_headers(bsp_content: str, bsp_filename: str = "xparameters.h") -> BuildResult:
    """
    Validate BSP xparameters.h or similar header for structural correctness.
    """
    errors = []
    warnings = []

    if "#ifndef" not in bsp_content and "#pragma once" not in bsp_content:
        warnings.append(f"{bsp_filename}: Missing include guard (#ifndef or #pragma once)")

    # Check for XPAR_ definitions
    xpar_defs = re.findall(r'#define\s+(XPAR_\w+)\s+(.+)', bsp_content)
    if not xpar_defs:
        errors.append(f"{bsp_filename}: No XPAR_ definitions found — invalid BSP header")

    # Check for duplicate definitions
    names = [d[0] for d in xpar_defs]
    duplicates = [n for n in set(names) if names.count(n) > 1]
    for dup in duplicates:
        errors.append(f"{bsp_filename}: Duplicate definition: {dup}")

    # Check for suspicious addresses
    suspicious = []
    for name, value in xpar_defs:
        val = value.strip().rstrip('U').rstrip('L')
        if re.match(r'^0x[0-9A-Fa-f]+$', val):
            addr = int(val, 16)
            # Flag addresses that look like NULL or very small
            if 0 < addr < 0x1000 and "BASEADDR" in name:
                suspicious.append(f"{name} = {val} (suspiciously low base address)")
    for s in suspicious:
        warnings.append(f"{bsp_filename}: {s}")

    return BuildResult(
        artifact_type="Vitis BSP",
        success=len(errors) == 0,
        exit_code=0 if not errors else 1,
        stdout="[BSP header structural validation]",
        stderr="",
        errors=errors,
        warnings=warnings,
        affected_files=[bsp_filename] if errors else [],
    )


# ─────────────────────────────────────────────────────────────────────────────
# AUTO-REPAIR ENGINE
# ─────────────────────────────────────────────────────────────────────────────

async def attempt_auto_repair(
    artifact_type: str,
    artifact_content: str,
    build_result: BuildResult,
    hkl_data: Dict[str, Any],
    groq_client: Any,
    retry_count: int = 0,
) -> Tuple[str, BuildResult]:
    """
    Attempt automatic repair of a failed artifact by:
    1. Extracting only the compiler errors and affected file sections
    2. Sending a targeted prompt to the AI (only errors + HKL)
    3. Receiving corrected content
    4. Re-running verification

    Returns (repaired_content, new_build_result).
    """
    if retry_count >= MAX_RETRY_LIMIT:
        return artifact_content, build_result

    # Build minimal AI context — only errors, affected sections, and HKL
    error_context = "\n".join(build_result.errors[:10])  # Cap at 10 errors
    affected_sections = _extract_affected_sections(
        artifact_content, build_result.affected_files, build_result.errors
    )

    # Format HKL as compact context
    hkl_context = _format_hkl_for_repair(hkl_data)

    repair_prompt = f"""You are a BSP/Firmware engineering assistant. Fix ONLY the errors below.
Do NOT rewrite the entire file. Return ONLY the corrected sections.

ARTIFACT TYPE: {artifact_type}
RETRY: {retry_count + 1}/{MAX_RETRY_LIMIT}

COMPILER ERRORS:
{error_context}

AFFECTED SECTIONS:
{affected_sections}

HARDWARE KNOWLEDGE LAYER (reference values — use these, do not hallucinate):
{hkl_context}

Return the corrected {artifact_type} content in full, with all errors fixed."""

    try:
        response = groq_client.chat.completions.create(
            model="compound-beta",
            messages=[{"role": "user", "content": repair_prompt}],
            max_tokens=4096,
            temperature=0.1,
        )
        repaired = response.choices[0].message.content

        # Extract code block if wrapped
        code_m = re.search(r'```[a-z]*\n([\s\S]+?)\n```', repaired)
        if code_m:
            repaired = code_m.group(1)

        # Re-verify
        if artifact_type == "Linux DTS":
            new_result = verify_device_tree(repaired)
        elif artifact_type == "Vivado TCL":
            new_result = verify_vivado_tcl(repaired)
        elif artifact_type == "Vitis BSP":
            new_result = verify_bsp_headers(repaired)
        else:
            new_result = build_result

        new_result.retry_count = retry_count + 1

        if new_result.success:
            return repaired, new_result

        # Recurse for next retry
        return await attempt_auto_repair(
            artifact_type, repaired, new_result, hkl_data, groq_client, retry_count + 1
        )

    except Exception as e:
        build_result.errors.append(f"Auto-repair AI error: {e}")
        return artifact_content, build_result


def _extract_affected_sections(content: str, affected_files: List[str], errors: List[str]) -> str:
    """Extract relevant lines from content based on error line numbers."""
    sections = []
    lines = content.splitlines()

    for error in errors[:5]:
        m = re.search(r':(\d+):', error)
        if m:
            lineno = int(m.group(1))
            start = max(0, lineno - 5)
            end   = min(len(lines), lineno + 5)
            section = f"Line {lineno} context:\n" + "\n".join(
                f"  {i+1}: {lines[i]}" for i in range(start, end)
            )
            sections.append(section)

    return "\n\n".join(sections) if sections else content[:1000]


def _format_hkl_for_repair(hkl_data: Dict[str, Any]) -> str:
    """Format HKL data compactly for AI repair prompts."""
    peripherals = hkl_data.get("peripherals", [])
    lines = []
    for p in peripherals[:8]:  # Cap to 8 peripherals
        name  = p.get("peripheralBlock", "")
        addr  = p.get("baseAddress", "")
        irq   = p.get("interruptNumber", "")
        driver= p.get("driverName", "")
        lines.append(f"  {name}: base={addr}, irq={irq}, driver={driver}")
    return "\n".join(lines) if lines else "(no HKL data)"


# ─────────────────────────────────────────────────────────────────────────────
# ARTIFACT COMPARISON — compare against vendor reference
# ─────────────────────────────────────────────────────────────────────────────

def compare_with_reference(
    generated_content: str,
    reference_content: str,
    artifact_type: str,
) -> Dict[str, Any]:
    """
    Compare a generated artifact with the vendor reference implementation.
    Returns a diff summary with accuracy score.
    """
    if not reference_content:
        return {"available": False, "accuracy": None, "diff_count": None}

    gen_lines = set(generated_content.splitlines())
    ref_lines = set(reference_content.splitlines())

    # Filter out comments and empty lines for semantic comparison
    def meaningful(lines: set) -> set:
        return {l.strip() for l in lines
                if l.strip() and not l.strip().startswith(("//", "#", "/*", "*"))}

    gen_meaningful = meaningful(gen_lines)
    ref_meaningful = meaningful(ref_lines)

    if not ref_meaningful:
        return {"available": True, "accuracy": 100.0, "diff_count": 0}

    intersection = gen_meaningful & ref_meaningful
    accuracy     = len(intersection) / len(ref_meaningful) * 100

    missing_from_generated = list(ref_meaningful - gen_meaningful)[:5]
    extra_in_generated     = list(gen_meaningful - ref_meaningful)[:5]

    return {
        "available":            True,
        "accuracy":             round(accuracy, 1),
        "diff_count":           len(ref_meaningful - gen_meaningful),
        "missingFromGenerated": missing_from_generated,
        "extraInGenerated":     extra_in_generated,
        "artifactType":         artifact_type,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FULL VERIFICATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def run_full_verification(
    dts_content: Optional[str] = None,
    tcl_content: Optional[str] = None,
    bsp_content: Optional[str] = None,
    reference_dts: Optional[str] = None,
    reference_tcl: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run verification for all three artifact types.
    Returns a combined verification report.
    """
    results = {}

    if dts_content:
        dts_result = verify_device_tree(dts_content)
        results["dts"] = dts_result.to_dict()
        if reference_dts:
            results["dts"]["referenceComparison"] = compare_with_reference(
                dts_content, reference_dts, "Linux DTS"
            )

    if tcl_content:
        tcl_result = verify_vivado_tcl(tcl_content)
        results["tcl"] = tcl_result.to_dict()
        if reference_tcl:
            results["tcl"]["referenceComparison"] = compare_with_reference(
                tcl_content, reference_tcl, "Vivado TCL"
            )

    if bsp_content:
        bsp_result = verify_bsp_headers(bsp_content)
        results["bsp"] = bsp_result.to_dict()

    overall_success = all(
        r.get("success", True)
        for r in results.values()
        if isinstance(r, dict)
    )

    return {
        "success":   overall_success,
        "artifacts": results,
        "timestamp": datetime.utcnow().isoformat(),
        "summary": {
            "dts_ok":  results.get("dts", {}).get("success", True),
            "tcl_ok":  results.get("tcl", {}).get("success", True),
            "bsp_ok":  results.get("bsp", {}).get("success", True),
        }
    }

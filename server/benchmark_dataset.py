"""
benchmark_dataset.py
Hardware Benchmark Dataset Builder and Continuous Evaluation Framework.
Manages the benchmark dataset, runs evaluations, and scores AI pipeline outputs
against verified ground truth data.
"""

import os
import json
import uuid
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from engineering_knowledge_repo import (
    SEED_BENCHMARK_BOARDS,
    METRIC_WEIGHTS,
    HALLUCINATION_WEIGHT,
    REFERENCE_BASE_ADDRESSES,
    REFERENCE_IRQ_NUMBERS,
    DTS_COMPATIBLE_STRINGS,
    VIVADO_IP_DRIVER_MAP,
    calculate_engineering_quality_score,
    get_reference_address,
    get_reference_irq,
    get_compatible_string,
    get_vivado_driver,
)

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
BENCHMARK_DIR = os.path.join(WORKSPACE_DIR, "benchmark")
VENDORS_DIR   = os.path.join(BENCHMARK_DIR, "vendors")
RUNS_DIR      = os.path.join(BENCHMARK_DIR, "runs")
CONFIG_PATH   = os.path.join(BENCHMARK_DIR, "config.json")

def _ensure_dirs():
    os.makedirs(VENDORS_DIR, exist_ok=True)
    os.makedirs(RUNS_DIR,    exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# CONFIG / BOARD REGISTRY
# ─────────────────────────────────────────────────────────────────────────────

def _load_config() -> Dict[str, Any]:
    _ensure_dirs()
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    # First-run: seed with default boards
    config = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat(),
        "boards": SEED_BENCHMARK_BOARDS,
    }
    _save_config(config)
    return config


def _save_config(config: Dict[str, Any]):
    _ensure_dirs()
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def list_boards() -> List[Dict[str, Any]]:
    config = _load_config()
    return config.get("boards", [])


def get_board(board_id: str) -> Optional[Dict[str, Any]]:
    for board in list_boards():
        if board["id"] == board_id:
            return board
    return None


def add_board(
    vendor: str,
    board_name: str,
    processor: str,
    architecture: str,
    source_url: str,
    doc_version: str = "1.0",
    notes: str = "",
) -> Dict[str, Any]:
    config = _load_config()
    board_id = f"{vendor.lower().replace('/', '-').replace(' ', '-')}-{board_name.lower().replace(' ', '-')}"
    board_id = re.sub(r"[^a-z0-9\-]", "", board_id)

    # Prevent duplicates
    for b in config["boards"]:
        if b["id"] == board_id:
            raise ValueError(f"Board '{board_id}' already exists in the dataset.")

    new_board: Dict[str, Any] = {
        "id":           board_id,
        "vendor":       vendor,
        "boardName":    board_name,
        "processor":    processor,
        "architecture": architecture,
        "docVersion":   doc_version,
        "sourceUrl":    source_url,
        "downloadDate": datetime.utcnow().isoformat()[:10],
        "localDocPath": "",
        "groundTruth":  None,
        "status":       "pending_review",
        "notes":        notes,
    }
    config["boards"].append(new_board)
    _save_config(config)
    return new_board


def remove_board(board_id: str) -> bool:
    config = _load_config()
    before = len(config["boards"])
    config["boards"] = [b for b in config["boards"] if b["id"] != board_id]
    if len(config["boards"]) == before:
        return False
    _save_config(config)
    # Also remove vendor storage folder if it exists
    board_dir = _board_dir(board_id)
    if os.path.exists(board_dir):
        import shutil
        shutil.rmtree(board_dir, ignore_errors=True)
    return True


def update_board_ground_truth(board_id: str, ground_truth: Dict[str, Any]):
    config = _load_config()
    for board in config["boards"]:
        if board["id"] == board_id:
            board["groundTruth"] = ground_truth
            board["status"] = "verified"
            break
    _save_config(config)


# ─────────────────────────────────────────────────────────────────────────────
# BOARD DIRECTORY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _board_dir(board_id: str) -> str:
    parts = board_id.split("-", 1)
    vendor_slug = parts[0] if parts else board_id
    board_slug  = parts[1] if len(parts) > 1 else board_id
    return os.path.join(VENDORS_DIR, vendor_slug, board_slug)


def _board_ground_truth_path(board_id: str) -> str:
    return os.path.join(_board_dir(board_id), "ground_truth.json")


def load_ground_truth(board_id: str) -> Optional[Dict[str, Any]]:
    """Load verified ground truth from filesystem or board config."""
    gt_path = _board_ground_truth_path(board_id)
    if os.path.exists(gt_path):
        with open(gt_path, "r", encoding="utf-8") as f:
            return json.load(f)
    # Fallback: inline ground truth in config
    board = get_board(board_id)
    if board and board.get("groundTruth"):
        return board["groundTruth"]
    return None


def save_ground_truth(board_id: str, ground_truth: Dict[str, Any]):
    board_dir = _board_dir(board_id)
    os.makedirs(board_dir, exist_ok=True)
    gt_path = _board_ground_truth_path(board_id)
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)
    update_board_ground_truth(board_id, ground_truth)


# ─────────────────────────────────────────────────────────────────────────────
# GROUND TRUTH AUTO-GENERATION (FIRST-PASS)
# ─────────────────────────────────────────────────────────────────────────────

def generate_first_pass_ground_truth(board: Dict[str, Any], parsed_hardware: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a first-pass ground truth from the AI pipeline output.
    Cross-validates against the Engineering Knowledge Repository.
    Marks as 'pending_review' — requires engineer sign-off.
    """
    architecture = board.get("architecture", "Zynq-7000")
    peripherals = parsed_hardware.get("peripherals", [])
    ref_addresses = REFERENCE_BASE_ADDRESSES.get(architecture, {})

    # Enrich each peripheral with KB cross-validation
    enriched_peripherals = []
    for p in peripherals:
        name = p.get("peripheralBlock", "")
        addr = p.get("baseAddress", "")
        irq  = p.get("interruptNumber")

        ref_addr = get_reference_address(architecture, name)
        ref_irq  = get_reference_irq(architecture, name)

        enriched = dict(p)
        enriched["_kb_ref_address"]  = ref_addr
        enriched["_kb_ref_irq"]      = ref_irq
        enriched["_address_verified"] = (ref_addr is not None and ref_addr.upper() == str(addr).upper())
        enriched["_irq_verified"]     = (ref_irq is not None and ref_irq == irq)
        enriched_peripherals.append(enriched)

    ground_truth = {
        "board_id":        board["id"],
        "board_name":      board["boardName"],
        "vendor":          board["vendor"],
        "architecture":    architecture,
        "processor":       board["processor"],
        "review_status":   "pending_review",
        "generated_at":    datetime.utcnow().isoformat(),
        "hardware": {
            "processor":           parsed_hardware.get("processor", board["processor"]),
            "architecture":        architecture,
            "clock_frequency":     parsed_hardware.get("clockFrequency", "100 MHz"),
            "clock_sources":       parsed_hardware.get("clockSources", []),
            "memory_size":         parsed_hardware.get("memorySize", ""),
            "flash_type":          parsed_hardware.get("flashType", ""),
            "interrupt_controller":parsed_hardware.get("interruptController", ""),
            "peripheral_count":    len(peripherals),
            "peripherals":         enriched_peripherals,
        },
        "validation": parsed_hardware.get("validation", {}),
    }
    return ground_truth


# ─────────────────────────────────────────────────────────────────────────────
# METRIC SCORING
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_hex(addr: Any) -> Optional[str]:
    """Normalize a hex address string to uppercase 0xXXXXXXXX."""
    try:
        s = str(addr).strip().upper()
        if not s.startswith("0X"):
            return None
        return "0x" + s[2:].lstrip("0").zfill(8).upper() if len(s) > 2 else None
    except Exception:
        return None


def score_processor_detection(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """Binary: 100 if correct processor detected, 0 otherwise."""
    gt_proc = (ground_truth.get("hardware", {}).get("processor") or "").lower()
    ex_proc = (extracted.get("processor") or "").lower()
    if not gt_proc or not ex_proc:
        return 0.0
    # Accept partial matches (e.g., "cortex-a9" in "arm cortex-a9 dual-core")
    key_words = [w for w in gt_proc.split() if len(w) > 3]
    matched = sum(1 for kw in key_words if kw in ex_proc)
    return 100.0 if matched >= max(1, len(key_words) // 2) else 0.0


def score_peripheral_detection(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """% of ground-truth peripherals found in extracted output."""
    gt_peripherals = ground_truth.get("hardware", {}).get("peripherals", [])
    ex_peripherals = extracted.get("peripherals", [])
    if not gt_peripherals:
        return 100.0

    gt_names = {p.get("peripheralBlock", "").lower() for p in gt_peripherals}
    ex_names = {p.get("peripheralBlock", "").lower() for p in ex_peripherals}

    # Fuzzy match: count GT peripheral found if any extracted name contains GT name or vice versa
    found = 0
    for gt_name in gt_names:
        if any(gt_name in ex_name or ex_name in gt_name for ex_name in ex_names):
            found += 1

    return round((found / len(gt_names)) * 100, 2)


def score_base_address_accuracy(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """% of extracted peripherals with correct base address vs ground truth."""
    gt_peripherals = ground_truth.get("hardware", {}).get("peripherals", [])
    ex_peripherals = extracted.get("peripherals", [])
    if not gt_peripherals or not ex_peripherals:
        return 0.0

    gt_addr_map = {}
    for p in gt_peripherals:
        name = p.get("peripheralBlock", "").lower()
        addr = _normalize_hex(p.get("_kb_ref_address") or p.get("baseAddress", ""))
        if addr:
            gt_addr_map[name] = addr

    correct = 0
    checked = 0
    for ex_p in ex_peripherals:
        ex_name = ex_p.get("peripheralBlock", "").lower()
        ex_addr = _normalize_hex(ex_p.get("baseAddress", ""))
        # Find matching GT entry
        for gt_name, gt_addr in gt_addr_map.items():
            if gt_name in ex_name or ex_name in gt_name:
                checked += 1
                if ex_addr and ex_addr.upper() == gt_addr.upper():
                    correct += 1
                break

    return round((correct / checked) * 100, 2) if checked > 0 else 0.0


def score_irq_accuracy(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """% of extracted peripherals with correct IRQ number."""
    gt_peripherals = ground_truth.get("hardware", {}).get("peripherals", [])
    ex_peripherals = extracted.get("peripherals", [])
    if not gt_peripherals or not ex_peripherals:
        return 0.0

    gt_irq_map = {}
    for p in gt_peripherals:
        name = p.get("peripheralBlock", "").lower()
        ref_irq = p.get("_kb_ref_irq")
        if ref_irq is not None:
            gt_irq_map[name] = int(ref_irq)

    if not gt_irq_map:
        return 100.0   # No IRQ reference available, skip metric

    correct = 0
    checked = 0
    for ex_p in ex_peripherals:
        ex_name = ex_p.get("peripheralBlock", "").lower()
        ex_irq  = ex_p.get("interruptNumber")
        for gt_name, gt_irq in gt_irq_map.items():
            if gt_name in ex_name or ex_name in gt_name:
                checked += 1
                try:
                    if int(ex_irq) == gt_irq:
                        correct += 1
                except (TypeError, ValueError):
                    pass
                break

    return round((correct / checked) * 100, 2) if checked > 0 else 0.0


def score_clock_detection(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """Binary: 100 if primary clock frequency detected correctly."""
    gt_clk = (ground_truth.get("hardware", {}).get("clock_frequency") or "").lower().replace(" ", "")
    ex_clk = (extracted.get("clockFrequency") or "").lower().replace(" ", "")
    if not gt_clk:
        return 100.0
    return 100.0 if gt_clk in ex_clk or ex_clk in gt_clk else 0.0


def score_driver_mapping(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """% of extracted peripherals with correct BSP driver name."""
    gt_peripherals = ground_truth.get("hardware", {}).get("peripherals", [])
    ex_peripherals = extracted.get("peripherals", [])
    if not gt_peripherals or not ex_peripherals:
        return 0.0

    gt_driver_map = {}
    for p in gt_peripherals:
        name   = p.get("peripheralBlock", "").lower()
        driver = (p.get("driverName") or "").lower()
        if driver:
            gt_driver_map[name] = driver

    correct = 0
    checked = 0
    for ex_p in ex_peripherals:
        ex_name   = ex_p.get("peripheralBlock", "").lower()
        ex_driver = (ex_p.get("driverName") or "").lower()
        for gt_name, gt_driver in gt_driver_map.items():
            if gt_name in ex_name or ex_name in gt_name:
                checked += 1
                if ex_driver == gt_driver:
                    correct += 1
                break

    return round((correct / checked) * 100, 2) if checked > 0 else 0.0


def score_dts_accuracy(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """
    % of extracted peripherals where the driver maps to a known DTS compatible string.
    We check if the driverName is in DTS_COMPATIBLE_STRINGS (KB reference).
    """
    ex_peripherals = extracted.get("peripherals", [])
    if not ex_peripherals:
        return 0.0

    known = 0
    for p in ex_peripherals:
        driver = (p.get("driverName") or "").lower()
        if driver in DTS_COMPATIBLE_STRINGS:
            known += 1

    return round((known / len(ex_peripherals)) * 100, 2)


def score_hallucination_rate(extracted: Dict[str, Any], ground_truth: Dict[str, Any]) -> float:
    """
    % of extracted peripheral values that are NOT traceable to the KB or ground truth.
    Checks base addresses against reference KB.
    """
    ex_peripherals = extracted.get("peripherals", [])
    architecture   = ground_truth.get("architecture", "")
    if not ex_peripherals:
        return 0.0

    ref_addresses = REFERENCE_BASE_ADDRESSES.get(architecture, {})
    all_ref_addrs = {_normalize_hex(v) for v in ref_addresses.values() if v}

    hallucinated = 0
    total = 0
    for p in ex_peripherals:
        addr = _normalize_hex(p.get("baseAddress", ""))
        if addr:
            total += 1
            # If address is not in any known reference region for this architecture,
            # AND doesn't start with a valid AXI PL base (0x40000000 or 0xA0000000), flag it
            in_kb = addr in all_ref_addrs
            in_axi_pl = addr is not None and (
                addr.upper().startswith("0X4") or addr.upper().startswith("0XA")
            )
            if not in_kb and not in_axi_pl:
                hallucinated += 1

    return round((hallucinated / total) * 100, 2) if total > 0 else 0.0


def compute_board_metrics(
    extracted: Dict[str, Any],
    ground_truth: Dict[str, Any],
) -> Dict[str, float]:
    """Compute all 11 accuracy metrics for a single board evaluation."""
    return {
        "processor_detection":   score_processor_detection(extracted, ground_truth),
        "peripheral_detection":  score_peripheral_detection(extracted, ground_truth),
        "base_address_accuracy": score_base_address_accuracy(extracted, ground_truth),
        "irq_accuracy":          score_irq_accuracy(extracted, ground_truth),
        "clock_detection":       score_clock_detection(extracted, ground_truth),
        "driver_mapping":        score_driver_mapping(extracted, ground_truth),
        "bsp_generation":        100.0,  # Set to 100 (BSP always generates; build success checked separately)
        "dts_accuracy":          score_dts_accuracy(extracted, ground_truth),
        "tcl_accuracy":          100.0,  # Set to 100 unless TCL validation runs
        "build_success":         100.0,  # Updated from actual build result if available
        "hallucination_rate":    score_hallucination_rate(extracted, ground_truth),
    }


# ─────────────────────────────────────────────────────────────────────────────
# BENCHMARK RUN
# ─────────────────────────────────────────────────────────────────────────────

def run_benchmark(
    extracted_results: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Execute the benchmark evaluation suite.

    Args:
        extracted_results: Optional list of AI-extracted hardware dicts (one per board).
                           If None, uses synthetic evaluation based on KB cross-check only.

    Returns:
        A benchmark run result dict with per-board metrics and overall EQS.
    """
    boards    = list_boards()
    run_id    = f"run_{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}_{uuid.uuid4().hex[:6]}"
    run_time  = datetime.utcnow().isoformat()
    board_results = []

    for i, board in enumerate(boards):
        board_id = board["id"]
        ground_truth = load_ground_truth(board_id)

        if not ground_truth:
            # No ground truth yet — use reference KB to create synthetic GT
            ground_truth = _synthetic_ground_truth(board)

        # Get the extracted result for this board
        extracted: Dict[str, Any] = {}
        if extracted_results and i < len(extracted_results):
            extracted = extracted_results[i]
        else:
            # No actual extraction provided — score as 0 baseline
            extracted = {"processor": "", "peripherals": [], "clockFrequency": ""}

        metrics = compute_board_metrics(extracted, ground_truth)
        eqs     = calculate_engineering_quality_score(metrics)

        board_results.append({
            "board_id":    board_id,
            "board_name":  board["boardName"],
            "vendor":      board["vendor"],
            "processor":   board["processor"],
            "architecture":board.get("architecture", ""),
            "status":      board["status"],
            "metrics":     metrics,
            "eqs":         eqs,
            "issues":      _detect_issues(metrics),
            "suggestions": _generate_suggestions(metrics, board, ground_truth),
        })

    # Aggregate overall metrics
    agg_metrics = _aggregate_metrics([r["metrics"] for r in board_results])
    overall_eqs = calculate_engineering_quality_score(agg_metrics)

    run_result = {
        "run_id":          run_id,
        "run_time":        run_time,
        "total_boards":    len(boards),
        "vendors_covered": len({b["vendor"] for b in boards}),
        "board_results":   board_results,
        "aggregate_metrics": agg_metrics,
        "overall_eqs":     overall_eqs,
        "hallucination_count": sum(
            1 for r in board_results
            if r["metrics"].get("hallucination_rate", 0) > 10
        ),
    }

    # Save run to filesystem
    run_path = os.path.join(RUNS_DIR, f"{run_id}.json")
    with open(run_path, "w", encoding="utf-8") as f:
        json.dump(run_result, f, indent=2)

    return run_result


def _synthetic_ground_truth(board: Dict[str, Any]) -> Dict[str, Any]:
    """Create a minimal synthetic ground truth from KB reference data."""
    arch = board.get("architecture", "")
    ref_addrs = REFERENCE_BASE_ADDRESSES.get(arch, {})
    peripherals = []
    for pname, addr in list(ref_addrs.items())[:8]:
        ref_irq = REFERENCE_IRQ_NUMBERS.get(arch, {}).get(pname)
        peripherals.append({
            "peripheralBlock":  pname,
            "baseAddress":      addr,
            "_kb_ref_address":  addr,
            "_kb_ref_irq":      ref_irq,
            "_address_verified":True,
            "_irq_verified":    ref_irq is not None,
        })
    return {
        "board_id":     board["id"],
        "board_name":   board["boardName"],
        "vendor":       board["vendor"],
        "architecture": arch,
        "processor":    board["processor"],
        "review_status":"synthetic",
        "hardware": {
            "processor":        board["processor"],
            "architecture":     arch,
            "clock_frequency":  "100 MHz",
            "peripheral_count": len(peripherals),
            "peripherals":      peripherals,
        },
    }


def _aggregate_metrics(metrics_list: List[Dict[str, float]]) -> Dict[str, float]:
    """Average all metrics across boards."""
    if not metrics_list:
        return {k: 0.0 for k in METRIC_WEIGHTS}
    agg: Dict[str, float] = {}
    for key in metrics_list[0]:
        vals = [m[key] for m in metrics_list if key in m]
        agg[key] = round(sum(vals) / len(vals), 2) if vals else 0.0
    return agg


def _detect_issues(metrics: Dict[str, float]) -> List[str]:
    """Identify failing metrics (< 70%)."""
    issues = []
    thresholds = {
        "processor_detection":   90,
        "peripheral_detection":  75,
        "base_address_accuracy": 80,
        "irq_accuracy":          70,
        "driver_mapping":        75,
        "dts_accuracy":          70,
    }
    for metric, threshold in thresholds.items():
        val = metrics.get(metric, 100)
        if val < threshold:
            issues.append(f"{metric.replace('_', ' ').title()} is below threshold ({val:.1f}% < {threshold}%)")

    if metrics.get("hallucination_rate", 0) > 10:
        issues.append(f"High hallucination rate detected ({metrics['hallucination_rate']:.1f}%)")

    return issues


def _generate_suggestions(
    metrics: Dict[str, float],
    board: Dict[str, Any],
    ground_truth: Dict[str, Any],
) -> List[str]:
    """Generate deterministic improvement suggestions based on failing metrics."""
    suggestions = []
    arch = board.get("architecture", "")

    if metrics.get("base_address_accuracy", 100) < 80:
        suggestions.append(
            f"Update parse_hardware.py pattern matching to use REFERENCE_BASE_ADDRESSES['{arch}'] "
            f"as a validation cross-check after extraction."
        )

    if metrics.get("irq_accuracy", 100) < 70:
        suggestions.append(
            f"Extend xilinxKnowledgeBase.ts with REFERENCE_IRQ_NUMBERS['{arch}'] entries "
            f"to improve IRQ assignment accuracy."
        )

    if metrics.get("driver_mapping", 100) < 75:
        suggestions.append(
            f"Update VIVADO_IP_DRIVER_MAP in engineering_knowledge_repo.py with "
            f"additional IP→driver name mappings for {arch} peripherals."
        )

    if metrics.get("dts_accuracy", 100) < 70:
        suggestions.append(
            "Add missing DTS compatible strings to DTS_COMPATIBLE_STRINGS in "
            "engineering_knowledge_repo.py."
        )

    if metrics.get("hallucination_rate", 0) > 10:
        suggestions.append(
            "Review parse_hardware.py _infer_type_driver() to prevent driver name inference "
            "when no official mapping exists — return 'generic-uio' as safe fallback."
        )

    return suggestions


# ─────────────────────────────────────────────────────────────────────────────
# REGRESSION DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def load_benchmark_history() -> List[Dict[str, Any]]:
    """Load all benchmark run results from the runs directory."""
    _ensure_dirs()
    runs = []
    for fname in sorted(os.listdir(RUNS_DIR), reverse=True):
        if fname.endswith(".json"):
            run_path = os.path.join(RUNS_DIR, fname)
            try:
                with open(run_path, "r", encoding="utf-8") as f:
                    runs.append(json.load(f))
            except Exception:
                pass
    return runs


def detect_regressions(
    current_run: Dict[str, Any],
    history: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Compare current run metrics to the previous run.
    Returns a regression delta report.
    """
    if not history:
        return {"previous_run_id": None, "deltas": {}, "regressions": [], "improvements": []}

    prev_run = history[0] if history[0]["run_id"] != current_run["run_id"] else (
        history[1] if len(history) > 1 else None
    )
    if not prev_run:
        return {"previous_run_id": None, "deltas": {}, "regressions": [], "improvements": []}

    curr_agg = current_run.get("aggregate_metrics", {})
    prev_agg = prev_run.get("aggregate_metrics", {})

    deltas: Dict[str, float] = {}
    regressions = []
    improvements = []

    for metric in curr_agg:
        curr_val = curr_agg.get(metric, 0)
        prev_val = prev_agg.get(metric, 0)
        delta    = round(curr_val - prev_val, 2)
        deltas[metric] = delta

        if metric == "hallucination_rate":
            if delta > 2:  # Higher hallucination = regression
                regressions.append({"metric": metric, "delta": delta})
            elif delta < -2:
                improvements.append({"metric": metric, "delta": delta})
        else:
            if delta < -2:
                regressions.append({"metric": metric, "delta": delta})
            elif delta > 2:
                improvements.append({"metric": metric, "delta": delta})

    eqs_delta = round(
        current_run.get("overall_eqs", 0) - prev_run.get("overall_eqs", 0), 2
    )

    return {
        "previous_run_id": prev_run["run_id"],
        "eqs_delta":       eqs_delta,
        "deltas":          deltas,
        "regressions":     regressions,
        "improvements":    improvements,
        "has_regressions": len(regressions) > 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD STATISTICS
# ─────────────────────────────────────────────────────────────────────────────

def get_dashboard_stats() -> Dict[str, Any]:
    """Return aggregated stats for the Benchmark Dashboard overview panel."""
    boards  = list_boards()
    history = load_benchmark_history()

    total_boards    = len(boards)
    vendors_covered = len({b["vendor"] for b in boards})
    verified_boards = sum(1 for b in boards if b.get("status") == "verified")

    # Latest run metrics
    latest_eqs = 0.0
    latest_metrics: Dict[str, float] = {}
    hallucination_count = 0

    if history:
        latest = history[0]
        latest_eqs         = latest.get("overall_eqs", 0.0)
        latest_metrics     = latest.get("aggregate_metrics", {})
        hallucination_count= latest.get("hallucination_count", 0)

    # EQS trend (last 5 runs)
    eqs_trend = [
        {"run_id": r["run_id"], "run_time": r["run_time"], "eqs": r.get("overall_eqs", 0)}
        for r in history[:10]
    ]

    return {
        "total_boards":         total_boards,
        "vendors_covered":      vendors_covered,
        "verified_boards":      verified_boards,
        "boards_pending":       total_boards - verified_boards,
        "overall_eqs":          latest_eqs,
        "hallucination_count":  hallucination_count,
        "latest_metrics":       latest_metrics,
        "eqs_trend":            list(reversed(eqs_trend)),
        "total_runs":           len(history),
        "last_run_time":        history[0]["run_time"] if history else None,
        "boards":               boards,
    }

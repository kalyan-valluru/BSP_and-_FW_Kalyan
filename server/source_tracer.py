"""
source_tracer.py
Source Traceability Engine — records every extracted hardware field with:
  - Value
  - Source (PDF, Table, OCR, Vision, Knowledge Base, XSA)
  - Page Number
  - Confidence Score
"""

import re
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class TraceRecord:
    """Immutable record of a single extracted hardware field."""
    artifact: str           # e.g. "UART0", "GPIO", "SystemClock"
    field: str              # e.g. "baseAddress", "interruptNumber", "driverName"
    value: str              # The extracted or resolved value
    source: str             # PDF | Table | OCR | Vision | Knowledge Base | XSA | AI Inference
    page: Optional[str]     # Page number string, or None
    confidence: float       # 0.0 – 1.0
    resolved: bool          # True if value was successfully determined
    resolution_path: List[str] = field(default_factory=list)  # Steps taken to resolve
    hallucination_risk: str = "low"  # low | medium | high
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SourceTracer:
    """
    Accumulates TraceRecords for all extracted fields during a hardware parsing session.
    Provides per-peripheral traceability and hallucination flagging.
    """

    def __init__(self):
        self._records: List[TraceRecord] = []

    def record(
        self,
        artifact: str,
        field_name: str,
        value: str,
        source: str,
        page: Optional[str] = None,
        confidence: float = 0.90,
        resolved: bool = True,
        resolution_path: Optional[List[str]] = None,
        hallucination_risk: str = "low",
    ) -> TraceRecord:
        tr = TraceRecord(
            artifact=artifact,
            field=field_name,
            value=value,
            source=source,
            page=page,
            confidence=confidence,
            resolved=resolved,
            resolution_path=resolution_path or [source],
            hallucination_risk=hallucination_risk,
        )
        self._records.append(tr)
        return tr

    def record_unresolved(
        self,
        artifact: str,
        field_name: str,
        attempted_sources: List[str],
    ) -> TraceRecord:
        """Record a field that could not be resolved from any source."""
        tr = TraceRecord(
            artifact=artifact,
            field=field_name,
            value="Unable to determine reliably — user validation required.",
            source="Unresolved",
            page=None,
            confidence=0.0,
            resolved=False,
            resolution_path=attempted_sources,
            hallucination_risk="high",
        )
        self._records.append(tr)
        return tr


    @property
    def records(self) -> List[TraceRecord]:
        return list(self._records)

    def records_for(self, artifact: str) -> List[TraceRecord]:
        return [r for r in self._records if r.artifact == artifact]

    def unresolved(self) -> List[TraceRecord]:
        return [r for r in self._records if not r.resolved]

    def high_risk(self) -> List[TraceRecord]:
        return [r for r in self._records if r.hallucination_risk == "high"]

    def to_decision_log(self) -> List[Dict[str, Any]]:
        """Format records for the frontend DecisionLog component."""
        return [
            {
                "artifact": r.artifact,
                "field": r.field,
                "value": r.value,
                "source": r.source,
                "reason": f"Resolved via {' → '.join(r.resolution_path)}" if r.resolution_path else "Direct extraction",
                "page": r.page or "—",
                "confidence": round(r.confidence * 100, 1),
                "resolved": r.resolved,
                "hallucinationRisk": r.hallucination_risk,
            }
            for r in self._records
        ]

    def summary(self) -> Dict[str, Any]:
        total = len(self._records)
        resolved_count = sum(1 for r in self._records if r.resolved)
        avg_confidence = (
            sum(r.confidence for r in self._records) / total if total else 0
        )
        return {
            "total_fields": total,
            "resolved": resolved_count,
            "unresolved": total - resolved_count,
            "average_confidence": round(avg_confidence * 100, 1),
            "high_risk_fields": len(self.high_risk()),
            "sources_used": list({r.source for r in self._records}),
        }


# ─────────────────────────────────────────────────────────────────────────────
# HALLUCINATION DETECTOR
# ─────────────────────────────────────────────────────────────────────────────

KNOWN_AXI_PL_REGIONS = [
    (0x40000000, 0x4FFFFFFF),  # Zynq-7000 PL AXI
    (0xA0000000, 0xAFFFFFFF),  # Zynq MPSoC PL AXI
    (0x80000000, 0x8FFFFFFF),  # Versal PL
]

VALID_DRIVER_PREFIXES = [
    "x", "imx_", "stm32_", "omap_", "fsl_", "ti_", "bcm_",
    "generic-uio", "generic_uart", "generic_gpio",
]


def assess_hallucination_risk(
    field_name: str,
    value: str,
    source: str,
    kb_verified: bool,
    reference_value: Optional[str] = None,
) -> str:
    """
    Assess hallucination risk for an extracted value.
    Returns 'low', 'medium', or 'high'.
    """
    if source in ("Knowledge Base", "XSA"):
        return "low"

    if reference_value is not None:
        if str(value).upper() == str(reference_value).upper():
            return "low"
        else:
            return "medium" if source == "PDF" else "high"

    if kb_verified:
        return "low"

    if field_name == "baseAddress":
        try:
            addr = int(str(value).replace("0x", "").replace("0X", ""), 16)
            for start, end in KNOWN_AXI_PL_REGIONS:
                if start <= addr <= end:
                    return "low"
            # If the address doesn't fall in any known region, medium risk
            return "medium" if source in ("PDF", "Table") else "high"
        except (ValueError, TypeError):
            return "high"

    if field_name == "driverName":
        v = str(value).lower()
        if any(v.startswith(prefix) for prefix in VALID_DRIVER_PREFIXES):
            return "low" if source != "AI Inference" else "medium"
        return "high"

    if field_name == "interruptNumber":
        try:
            irq = int(value)
            if 0 <= irq <= 255:
                return "low" if kb_verified else "medium"
        except (ValueError, TypeError):
            pass
        return "high"

    return "medium" if source == "AI Inference" else "low"


def scan_for_hallucinations(
    peripherals: List[Dict[str, Any]],
    architecture: str,
    tracer: Optional[SourceTracer] = None,
) -> List[Dict[str, Any]]:
    """
    Scan extracted peripherals for hallucination risk.
    Returns a list of hallucination findings.
    """
    from engineering_knowledge_repo import (
        REFERENCE_BASE_ADDRESSES, REFERENCE_IRQ_NUMBERS, VIVADO_IP_DRIVER_MAP
    )

    ref_addrs = REFERENCE_BASE_ADDRESSES.get(architecture, {})
    ref_irqs  = REFERENCE_IRQ_NUMBERS.get(architecture, {})
    all_ref_addrs = {v.upper() for v in ref_addrs.values()}

    findings = []
    for p in peripherals:
        name = p.get("peripheralBlock", "UNKNOWN")

        # Check base address
        addr = str(p.get("baseAddress", "")).upper()
        addr_in_kb = addr in all_ref_addrs
        addr_in_pl = any(
            int(addr.replace("0X", ""), 16) in range(s, e + 1)
            if re.match(r'^0X[0-9A-F]+$', addr) else False
            for s, e in KNOWN_AXI_PL_REGIONS
        )
        if not addr_in_kb and not addr_in_pl and re.match(r'^0X[0-9A-F]{4,8}$', addr):
            findings.append({
                "peripheral": name,
                "field": "baseAddress",
                "value": addr,
                "risk": "medium",
                "reason": f"Address {addr} not found in KB reference for {architecture}",
                "suggestion": f"Verify against official {architecture} memory map",
            })

        # Check driver name
        driver = str(p.get("driverName", "")).lower()
        if driver and driver not in ("n/a", "generic-uio"):
            is_known = any(driver.startswith(pfx) for pfx in VALID_DRIVER_PREFIXES)
            if not is_known:
                findings.append({
                    "peripheral": name,
                    "field": "driverName",
                    "value": driver,
                    "risk": "high",
                    "reason": f"Driver name '{driver}' does not match any known BSP driver pattern",
                    "suggestion": "Check xilinxKnowledgeBase.ts or engineering_knowledge_repo.py for correct driver name",
                })

        # Check IRQ number against known range
        irq = p.get("interruptNumber")
        if irq is not None and irq != "Requires Vivado/XSA":
            try:
                irq_int = int(irq)
                # Look up expected IRQ for this peripheral
                pn = name.upper()
                matched_irq = None
                for ref_name, ref_irq in ref_irqs.items():
                    if ref_name in pn or pn in ref_name:
                        matched_irq = ref_irq
                        break
                if matched_irq is not None and irq_int != matched_irq:
                    findings.append({
                        "peripheral": name,
                        "field": "interruptNumber",
                        "value": str(irq_int),
                        "risk": "medium",
                        "reason": f"IRQ {irq_int} differs from KB reference {matched_irq} for {name}",
                        "suggestion": f"Expected IRQ: {matched_irq} per official {architecture} datasheet",
                    })
            except (ValueError, TypeError):
                pass

    return findings

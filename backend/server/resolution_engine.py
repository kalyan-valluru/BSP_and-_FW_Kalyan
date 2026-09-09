"""
resolution_engine.py
Resolution Engine — attempts to resolve missing hardware information by
searching through: Register Maps, Tables, OCR, Vision, HKL, and Vivado XSA.
If all sources fail, returns "Requires Vivado/XSA" with a validation warning.
"""

import re
import os
import json
from typing import Dict, List, Optional, Any, Tuple
from source_tracer import SourceTracer, assess_hallucination_risk


# ─────────────────────────────────────────────────────────────────────────────
# RESOLUTION SOURCE PRIORITY (in order)
# ─────────────────────────────────────────────────────────────────────────────
RESOLUTION_CHAIN = [
    "Register Map",       # 1. Structured register map text/JSON
    "Table",              # 2. Tabular data extracted by pdfplumber
    "Schematic",          # 3. OCR on schematic image
    "OCR",                # 4. Raw EasyOCR text
    "Vision",             # 5. Groq Vision LLM
    "Knowledge Base",     # 6. Engineering Knowledge Repository
    "Vivado XSA",         # 7. Vivado HW Export (.xsa / .hdf)
]

UNRESOLVED_VALUE = "Unable to determine reliably — user validation required."


class ResolutionEngine:
    """
    Attempts to resolve a missing hardware field using a cascaded source chain.
    Records every resolution attempt in the SourceTracer.
    """

    def __init__(
        self,
        architecture: str,
        tracer: Optional[SourceTracer] = None,
        xsa_path: Optional[str] = None,
    ):
        self.architecture = architecture
        self.tracer = tracer or SourceTracer()
        self.xsa_path = xsa_path
        self._xsa_data: Optional[Dict[str, Any]] = None

        # Lazy-load KB data
        try:
            from engineering_knowledge_repo import (
                REFERENCE_BASE_ADDRESSES,
                REFERENCE_IRQ_NUMBERS,
                DTS_COMPATIBLE_STRINGS,
                VIVADO_IP_DRIVER_MAP,
            )
            self._ref_addrs = REFERENCE_BASE_ADDRESSES.get(architecture, {})
            self._ref_irqs  = REFERENCE_IRQ_NUMBERS.get(architecture, {})
            self._dts_compat = DTS_COMPATIBLE_STRINGS
            self._vivado_map = VIVADO_IP_DRIVER_MAP
        except ImportError:
            self._ref_addrs = {}
            self._ref_irqs  = {}
            self._dts_compat = {}
            self._vivado_map = {}

    # ── XSA / HDF LOADER ────────────────────────────────────────────────────

    def _load_xsa(self) -> Optional[Dict[str, Any]]:
        """Load and parse the Vivado XSA export if available."""
        if self._xsa_data is not None:
            return self._xsa_data
        if not self.xsa_path or not os.path.exists(self.xsa_path):
            return None
        try:
            import zipfile, xml.etree.ElementTree as ET
            with zipfile.ZipFile(self.xsa_path, 'r') as z:
                # Try hwh file (Vivado 2019+)
                hwh_files = [n for n in z.namelist() if n.endswith('.hwh')]
                if hwh_files:
                    with z.open(hwh_files[0]) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                    self._xsa_data = self._parse_hwh_xml(content)
                    return self._xsa_data
        except Exception:
            pass
        return None

    def _parse_hwh_xml(self, xml_content: str) -> Dict[str, Any]:
        """Extract base addresses and IRQs from Vivado HWH XML."""
        import xml.etree.ElementTree as ET
        result: Dict[str, Any] = {"peripherals": {}}
        try:
            root = ET.fromstring(xml_content)
            ns = {'': 'http://www.xilinx.com/schema/hwh'}

            for ip in root.findall('.//IP'):
                name = ip.get('NAME', '') or ip.get('VLNV', '').split(':')[-2]
                addr_m = re.search(r'BASEADDR["\s:=]+([0-9A-Fa-f xX]+)', ET.tostring(ip, encoding='unicode'))
                irq_m  = re.search(r'INTERRUPT["\s:=]+(\d+)', ET.tostring(ip, encoding='unicode'))
                result['peripherals'][name.lower()] = {
                    'baseAddress': addr_m.group(1).strip() if addr_m else None,
                    'irq': int(irq_m.group(1)) if irq_m else None,
                }
        except Exception:
            pass
        return result

    # ── FIELD RESOLVERS ─────────────────────────────────────────────────────

    def resolve_base_address(
        self,
        peripheral_name: str,
        raw_text: str,
        tables: Optional[List[List[str]]] = None,
        ocr_text: str = "",
        vision_text: str = "",
    ) -> Tuple[Optional[str], str, float]:
        """
        Resolve base address for a peripheral.
        Returns (value, source, confidence).
        """
        pn = peripheral_name.upper()
        pn_lower = peripheral_name.lower()
        attempted = []

        # 1. Register Map — look for XPAR_<NAME>_BASEADDR or similar
        attempted.append("Register Map")
        patterns = [
            rf'XPAR_{re.escape(pn)}_BASEADDR\s+(0x[0-9A-Fa-f]{{1,8}})',
            rf'#define\s+{re.escape(pn)}\s+(0x[0-9A-Fa-f]{{1,8}})',
            rf'{re.escape(peripheral_name)}[^a-z]*base[^a-z]*address[^:=]*(0x[0-9A-Fa-f]{{1,8}})',
        ]
        for pat in patterns:
            m = re.search(pat, raw_text, re.IGNORECASE)
            if m:
                return m.group(1), "Register Map", 0.95

        # 2. Tables
        attempted.append("Table")
        if tables:
            for table in tables:
                for row in table:
                    row_str = ' '.join(str(c) for c in row) if isinstance(row, (list, tuple)) else str(row)
                    if pn_lower in row_str.lower():
                        addr_m = re.search(r'(0x[0-9A-Fa-f]{4,8})', row_str)
                        if addr_m:
                            return addr_m.group(1), "Table", 0.90

        # 3. Schematic OCR
        attempted.append("Schematic")
        if ocr_text:
            m = re.search(rf'{re.escape(pn_lower)}[^a-z]*(0x[0-9A-Fa-f]{{4,8}})', ocr_text, re.IGNORECASE)
            if m:
                return m.group(1), "OCR", 0.80

        # 4. Vision output
        attempted.append("Vision")
        if vision_text:
            m = re.search(rf'PERIPHERAL:\s*{re.escape(pn_lower)}.*?ADDR:\s*(0x[0-9A-Fa-f]{{4,8}})', vision_text, re.IGNORECASE)
            if not m:
                m = re.search(rf'{re.escape(pn_lower)}[^|]*\|(0x[0-9A-Fa-f]{{4,8}})', vision_text, re.IGNORECASE)
            if m:
                return m.group(1), "Vision", 0.85

        # 5. Knowledge Base
        attempted.append("Knowledge Base")
        for key, addr in self._ref_addrs.items():
            if key.upper() in pn or pn in key.upper():
                return addr, "Knowledge Base", 0.88

        # 6. Vivado XSA
        attempted.append("Vivado XSA")
        xsa = self._load_xsa()
        if xsa:
            for ip_name, ip_data in xsa.get("peripherals", {}).items():
                if pn_lower in ip_name or ip_name in pn_lower:
                    if ip_data.get('baseAddress'):
                        return ip_data['baseAddress'], "Vivado XSA", 0.98

        # Unresolved
        self.tracer.record_unresolved(peripheral_name, "baseAddress", attempted)
        return None, "Unresolved", 0.0

    def resolve_irq(
        self,
        peripheral_name: str,
        raw_text: str,
        tables: Optional[List[List[str]]] = None,
        ocr_text: str = "",
        vision_text: str = "",
    ) -> Tuple[Optional[Any], str, float]:
        """Resolve IRQ/interrupt number for a peripheral."""
        pn = peripheral_name.upper()
        pn_lower = peripheral_name.lower()
        attempted = []

        # 1. Register Map patterns
        attempted.append("Register Map")
        patterns = [
            rf'XPAR_{re.escape(pn)}_INTR\s+(\d+)',
            rf'{re.escape(pn_lower)}[^a-z]*(?:irq|interrupt)[^a-z]*(\d+)',
            rf'(?:irq|interrupt)\s*(?:id|number|num)?\s*(?:for)?\s*{re.escape(pn_lower)}\s*[:\s=]+\s*(\d+)',
        ]
        for pat in patterns:
            m = re.search(pat, raw_text, re.IGNORECASE)
            if m:
                return int(m.group(1)), "Register Map", 0.93

        # 2. Tables
        attempted.append("Table")
        if tables:
            for table in tables:
                for row in table:
                    row_str = ' '.join(str(c) for c in row) if isinstance(row, (list, tuple)) else str(row)
                    if pn_lower in row_str.lower():
                        irq_m = re.search(r'\b(\d{1,3})\b', row_str)
                        if irq_m and 0 <= int(irq_m.group(1)) <= 255:
                            return int(irq_m.group(1)), "Table", 0.82

        # 3. OCR
        attempted.append("OCR")
        if ocr_text:
            m = re.search(rf'{re.escape(pn_lower)}[^a-z]*(?:irq|intr)[^a-z]*(\d+)', ocr_text, re.IGNORECASE)
            if m:
                return int(m.group(1)), "OCR", 0.75

        # 4. Vision
        attempted.append("Vision")
        if vision_text:
            m = re.search(rf'PERIPHERAL:\s*{re.escape(pn_lower)}.*?IRQ:\s*(\d+)', vision_text, re.IGNORECASE)
            if m:
                return int(m.group(1)), "Vision", 0.82

        # 5. Knowledge Base
        attempted.append("Knowledge Base")
        for key, irq in self._ref_irqs.items():
            if key.upper() in pn or pn in key.upper():
                return irq, "Knowledge Base", 0.88

        # 6. XSA
        attempted.append("Vivado XSA")
        xsa = self._load_xsa()
        if xsa:
            for ip_name, ip_data in xsa.get("peripherals", {}).items():
                if pn_lower in ip_name or ip_name in pn_lower:
                    if ip_data.get('irq') is not None:
                        return ip_data['irq'], "Vivado XSA", 0.98

        self.tracer.record_unresolved(peripheral_name, "interruptNumber", attempted)
        return UNRESOLVED_VALUE, "Unresolved", 0.0

    def resolve_driver(
        self,
        peripheral_name: str,
        peripheral_type: str,
        raw_text: str = "",
    ) -> Tuple[str, str, float]:
        """Resolve BSP driver name for a peripheral."""
        pn_lower = peripheral_name.lower()
        ptype = peripheral_type.lower()
        attempted = []

        # 1. Register Map — look for #include or XDriver pattern
        attempted.append("Register Map")
        driver_m = re.search(rf'#include\s*[<"](x[a-z]+\.h)[>"]', raw_text, re.IGNORECASE)
        if driver_m:
            header = driver_m.group(1)
            # Reverse-map header to driver name
            driver = header.replace('.h', '')
            return driver, "Register Map", 0.88

        # 2. Vivado IP name pattern from peripheral block name
        attempted.append("Knowledge Base")
        for ip_key, driver_name in self._vivado_map.items():
            if ip_key.replace('_', '') in pn_lower.replace('_', '') or pn_lower.startswith(ip_key[:4]):
                return driver_name, "Knowledge Base", 0.91

        # 3. Type-based inference from KB
        type_driver_map = {
            "uart":    {"Zynq-7000": "xuartps", "Zynq UltraScale+": "xuartps",
                        "MicroBlaze": "xuartlite", "STM32H7": "stm32_uart", "AM335x": "omap_uart"},
            "gpio":    {"Zynq-7000": "xgpiops", "Zynq UltraScale+": "xgpiops",
                        "MicroBlaze": "xgpio",     "STM32H7": "stm32_gpio", "AM335x": "omap_gpio"},
            "i2c":     {"Zynq-7000": "xiicps",  "Zynq UltraScale+": "xiicps",
                        "MicroBlaze": "xiic",      "STM32H7": "stm32_i2c",  "AM335x": "omap_i2c"},
            "spi":     {"Zynq-7000": "xspips",  "Zynq UltraScale+": "xspips",
                        "MicroBlaze": "xspi",      "STM32H7": "stm32_spi",  "AM335x": "omap_mcspi"},
            "ethernet":{"Zynq-7000": "xemacps", "Zynq UltraScale+": "xemacps",
                        "STM32H7": "stm32_eth", "AM335x": "cpsw"},
            "timer":   {"Zynq-7000": "xttcps",  "Zynq UltraScale+": "xttcps",
                        "MicroBlaze": "xtmrctr",   "STM32H7": "stm32_timer"},
            "dma":     {"Zynq-7000": "xaxidma", "Zynq UltraScale+": "xaxidma",
                        "MicroBlaze": "xaxidma"},
            "sd/mmc":  {"Zynq-7000": "xsdps",   "Zynq UltraScale+": "xsdps"},
            "can":     {"Zynq-7000": "xcanps",  "Zynq UltraScale+": "xcanps"},
            "usb":     {"Zynq-7000": "xusbps",  "Zynq UltraScale+": "xusbps"},
        }
        for type_key, arch_map in type_driver_map.items():
            if type_key in ptype or type_key.replace("/", "") in ptype:
                driver = arch_map.get(self.architecture)
                if driver:
                    return driver, "Knowledge Base", 0.85
                break

        return "generic-uio", "Knowledge Base", 0.50

    def resolve_pin_mapping(
        self,
        peripheral_name: str,
        raw_text: str,
        ocr_text: str = "",
        vision_text: str = "",
        xsa_available: bool = False,
    ) -> Tuple[str, str, float]:
        """Resolve physical pin mapping for a peripheral."""
        pn_lower = peripheral_name.lower()
        attempted = []

        # 1. Schematic text patterns
        attempted.append("Schematic")
        pin_patterns = [
            rf'{re.escape(pn_lower)}[^a-z]*(?:mio|emio|io)\s*\[?(\d+(?::\d+)?)\]?',
            rf'{re.escape(pn_lower)}[^a-z]*(?:pin|pad|ball)\s*[:\s=]?\s*([A-Z][0-9A-Z]+)',
            rf'(?:rx|tx|sda|scl|miso|mosi|sck)\s*[:\s=]?\s*([A-Z0-9]+)\s',
        ]
        for pat in pin_patterns:
            m = re.search(pat, raw_text + "\n" + ocr_text, re.IGNORECASE)
            if m:
                return f"MIO[{m.group(1)}]" if m.group(1).isdigit() else m.group(1), "Schematic", 0.80

        # 2. Vision output
        attempted.append("Vision")
        if vision_text:
            m = re.search(rf'PERIPHERAL:\s*{re.escape(pn_lower)}.*?PINS:\s*([^\|\\n]+)', vision_text, re.IGNORECASE)
            if m:
                val = m.group(1).strip()
                if val and val.lower() not in ("n/a", "requires vivado/xsa"):
                    return val, "Vision", 0.78

        # 3. XSA available but not loaded
        if xsa_available:
            return UNRESOLVED_VALUE, "Requires Vivado/XSA", 0.0

        self.tracer.record_unresolved(peripheral_name, "physicalPinMapping", attempted)
        return UNRESOLVED_VALUE, "Unresolved", 0.0

    # ── FULL PERIPHERAL RESOLUTION ───────────────────────────────────────────

    def resolve_peripheral(
        self,
        peripheral: Dict[str, Any],
        raw_text: str,
        tables: Optional[List[List[str]]] = None,
        ocr_text: str = "",
        vision_text: str = "",
        xsa_available: bool = False,
    ) -> Dict[str, Any]:
        """
        Run the full resolution chain for a single peripheral.
        Updates missing fields and records all traceability information.
        Returns the enriched peripheral dict with traceability metadata.
        """
        name  = peripheral.get("peripheralBlock", "UNKNOWN")
        ptype = peripheral.get("type", "GPIO")
        result = dict(peripheral)
        traces = []

        # ── Base Address ──────────────────────────────────────────────────
        addr = result.get("baseAddress", "")
        if not addr or addr in ("N/A", "0x00000000", ""):
            resolved_addr, src, conf = self.resolve_base_address(
                name, raw_text, tables, ocr_text, vision_text
            )
            if resolved_addr:
                result["baseAddress"] = resolved_addr
                risk = assess_hallucination_risk("baseAddress", resolved_addr, src, src == "Knowledge Base")
                tr = self.tracer.record(name, "baseAddress", resolved_addr, src, confidence=conf,
                                        hallucination_risk=risk)
                traces.append(tr.to_dict())
            else:
                result["baseAddress"] = UNRESOLVED_VALUE
                tr = self.tracer.record_unresolved(name, "baseAddress",
                                                    ["Register Map", "Table", "OCR", "Vision", "Knowledge Base", "XSA"])
                traces.append(tr.to_dict())
        else:
            # Record existing value with source inference
            src = "PDF" if result.get("confidence", 0) > 90 else "AI Inference"
            risk = assess_hallucination_risk("baseAddress", addr, src, False)
            tr = self.tracer.record(name, "baseAddress", addr, src,
                                     confidence=result.get("confidence", 90) / 100.0,
                                     hallucination_risk=risk)
            traces.append(tr.to_dict())

        # ── IRQ ──────────────────────────────────────────────────────────
        irq = result.get("interruptNumber")
        if irq is None or irq == UNRESOLVED_VALUE or irq == "Requires Vivado/XSA":
            resolved_irq, src, conf = self.resolve_irq(
                name, raw_text, tables, ocr_text, vision_text
            )
            result["interruptNumber"] = resolved_irq
            if resolved_irq != UNRESOLVED_VALUE and resolved_irq is not None:
                tr = self.tracer.record(name, "interruptNumber", str(resolved_irq), src,
                                         confidence=conf)
                traces.append(tr.to_dict())
        else:
            tr = self.tracer.record(name, "interruptNumber", str(irq), "PDF", confidence=0.88)
            traces.append(tr.to_dict())

        # ── Driver Name ───────────────────────────────────────────────────
        driver = result.get("driverName", "")
        if not driver or driver in ("N/A", "generic-uio", "custom_driver", ""):
            resolved_driver, src, conf = self.resolve_driver(name, ptype, raw_text)
            result["driverName"] = resolved_driver
            tr = self.tracer.record(name, "driverName", resolved_driver, src, confidence=conf)
            traces.append(tr.to_dict())
        else:
            tr = self.tracer.record(name, "driverName", driver, "PDF", confidence=0.90)
            traces.append(tr.to_dict())

        # ── Pin Mapping ───────────────────────────────────────────────────
        pins = result.get("physicalPinMapping", "")
        if not pins or pins in ("N/A", UNRESOLVED_VALUE, "Requires Vivado/XSA"):
            resolved_pins, src, conf = self.resolve_pin_mapping(
                name, raw_text, ocr_text, vision_text, xsa_available
            )
            result["physicalPinMapping"] = resolved_pins
            if resolved_pins != UNRESOLVED_VALUE:
                tr = self.tracer.record(name, "physicalPinMapping", resolved_pins, src, confidence=conf)
                traces.append(tr.to_dict())

        # Attach traceability metadata
        result["_traceability"] = traces
        result["_resolutionComplete"] = (
            result.get("baseAddress", "") not in ("", "N/A", UNRESOLVED_VALUE) and
            result.get("driverName", "") not in ("", "N/A")
        )

        return result


# ─────────────────────────────────────────────────────────────────────────────
# ENGINEERING READINESS ASSESSMENT
# ─────────────────────────────────────────────────────────────────────────────

def assess_engineering_readiness(
    peripherals: List[Dict[str, Any]],
    build_status: str = "idle",
    compilation_logs: Optional[List[str]] = None,
    hallucination_findings: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Compute the Engineering Readiness Dashboard levels.
    Returns a structured readiness report.
    """
    total = len(peripherals)
    if total == 0:
        return _empty_readiness()

    resolved_addr = sum(
        1 for p in peripherals
        if p.get("baseAddress") and p["baseAddress"] not in ("", "N/A", "Requires Vivado/XSA")
    )
    resolved_irq = sum(
        1 for p in peripherals
        if p.get("interruptNumber") is not None and
           p["interruptNumber"] not in ("Requires Vivado/XSA", "N/A")
    )
    resolved_driver = sum(
        1 for p in peripherals
        if p.get("driverName") and p["driverName"] not in ("", "N/A")
    )
    resolved_pins = sum(
        1 for p in peripherals
        if p.get("physicalPinMapping") and
           p["physicalPinMapping"] not in ("N/A", "Requires Vivado/XSA")
    )

    addr_pct   = (resolved_addr   / total) * 100
    irq_pct    = (resolved_irq    / total) * 100
    driver_pct = (resolved_driver / total) * 100
    pin_pct    = (resolved_pins   / total) * 100

    hallucination_count = len(hallucination_findings or [])
    high_risk = sum(1 for h in (hallucination_findings or []) if h.get("risk") == "high")

    # ── Gate conditions ───────────────────────────────────────────────────
    extraction_ready = addr_pct >= 80 and driver_pct >= 80
    validation_ready = extraction_ready and irq_pct >= 60 and hallucination_count == 0
    compilation_ready = validation_ready and driver_pct >= 90
    simulation_ready  = compilation_ready and build_status == "success"
    deployment_ready  = simulation_ready and high_risk == 0 and pin_pct >= 70

    issues = []
    if addr_pct < 80:
        issues.append(f"Only {addr_pct:.0f}% of base addresses resolved — need ≥80%")
    if driver_pct < 80:
        issues.append(f"Only {driver_pct:.0f}% of driver names resolved — need ≥80%")
    if irq_pct < 60:
        issues.append(f"Only {irq_pct:.0f}% of IRQs resolved — need ≥60%")
    if hallucination_count > 0:
        issues.append(f"{hallucination_count} potential hallucinations detected")
    if high_risk > 0:
        issues.append(f"{high_risk} high-risk hallucinations require manual verification")
    if build_status == "error":
        issues.append("Build failed — review compiler logs")
    if pin_pct < 70 and simulation_ready:
        issues.append(f"Only {pin_pct:.0f}% of pin mappings resolved — need Vivado/XSA for deployment")

    return {
        "gates": {
            "extraction":   {"ready": extraction_ready,   "score": round(min(addr_pct, driver_pct), 1)},
            "validation":   {"ready": validation_ready,   "score": round((addr_pct + irq_pct + driver_pct) / 3, 1)},
            "compilation":  {"ready": compilation_ready,  "score": round(driver_pct, 1)},
            "simulation":   {"ready": simulation_ready,   "score": 100.0 if build_status == "success" else 0.0},
            "deployment":   {"ready": deployment_ready,   "score": round(min(pin_pct, 100 - hallucination_count * 5), 1)},
        },
        "metrics": {
            "addressResolution": round(addr_pct, 1),
            "irqResolution":     round(irq_pct, 1),
            "driverResolution":  round(driver_pct, 1),
            "pinResolution":     round(pin_pct, 1),
            "hallucinationCount":hallucination_count,
            "highRiskCount":     high_risk,
            "buildStatus":       build_status,
        },
        "issues": issues,
        "overallReady": deployment_ready,
    }


def _empty_readiness() -> Dict[str, Any]:
    """Return a readiness report for an empty peripheral list."""
    return {
        "gates": {
            "extraction":  {"ready": False, "score": 0.0},
            "validation":  {"ready": False, "score": 0.0},
            "compilation": {"ready": False, "score": 0.0},
            "simulation":  {"ready": False, "score": 0.0},
            "deployment":  {"ready": False, "score": 0.0},
        },
        "metrics": {
            "addressResolution": 0.0,
            "irqResolution":     0.0,
            "driverResolution":  0.0,
            "pinResolution":     0.0,
            "hallucinationCount":0,
            "highRiskCount":     0,
            "buildStatus":       "idle",
        },
        "issues": ["No peripherals loaded"],
        "overallReady": False,
    }

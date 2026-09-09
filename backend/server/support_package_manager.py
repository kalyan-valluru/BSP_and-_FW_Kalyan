"""
support_package_manager.py
Dynamic Processor Support Package Manager
1. Detects unknown processor vendor and model.
2. Searches official vendor document sources.
3. Downloads, caches, and compiles dynamic Processor Support Packages.
4. Registers new packages dynamically in the Platform Registry.
"""

import os
import json
import re
import urllib.request
import urllib.parse
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "workspace", "support_packages")
os.makedirs(CACHE_DIR, exist_ok=True)

# Authorized vendor search directories & domains (Never search or fetch from unofficial domains)
AUTHORIZED_DOMAINS = {
    "AMD/Xilinx": "xilinx.com",
    "NXP": "nxp.com",
    "STMicroelectronics": "st.com",
    "Texas Instruments": "ti.com",
    "Microchip": "microchip.com",
    "Intel FPGA": "intel.com",
    "Raspberry Pi": "raspberrypi.com",
}


class SupportPackage:
    def __init__(
        self,
        package_id: str,
        vendor: str,
        model: str,
        version: str,
        doc_urls: List[str],
        peripherals: Dict[str, Any],
        drivers: Dict[str, str],
        clocks: Dict[str, Any],
        interrupts: Dict[str, int],
        register_maps: Dict[str, Any],
        download_date: str = "",
    ):
        self.package_id = package_id
        self.vendor = vendor
        self.model = model
        self.version = version
        self.doc_urls = doc_urls
        self.peripherals = peripherals
        self.drivers = drivers
        self.clocks = clocks
        self.interrupts = interrupts
        self.register_maps = register_maps
        self.download_date = download_date or datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "packageId": self.package_id,
            "vendor": self.vendor,
            "model": self.model,
            "version": self.version,
            "docUrls": self.doc_urls,
            "peripherals": self.peripherals,
            "drivers": self.drivers,
            "clocks": self.clocks,
            "interrupts": self.interrupts,
            "registerMaps": self.register_maps,
            "downloadDate": self.download_date,
        }

    def save(self):
        file_path = os.path.join(CACHE_DIR, f"{self.package_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)


class SupportPackageManager:
    """Manages searching, downloading, caching, and building Processor Support Packages."""

    def __init__(self):
        self.packages: Dict[str, SupportPackage] = {}
        self.load_cached_packages()

    def load_cached_packages(self):
        for file in os.listdir(CACHE_DIR):
            if file.endswith(".json"):
                try:
                    with open(os.path.join(CACHE_DIR, file), "r", encoding="utf-8") as f:
                        data = json.load(f)
                        pkg = SupportPackage(
                            package_id=data["packageId"],
                            vendor=data["vendor"],
                            model=data["model"],
                            version=data["version"],
                            doc_urls=data["docUrls"],
                            peripherals=data["peripherals"],
                            drivers=data["drivers"],
                            clocks=data["clocks"],
                            interrupts=data["interrupts"],
                            register_maps=data["registerMaps"],
                            download_date=data["downloadDate"],
                        )
                        self.packages[pkg.package_id] = pkg
                except Exception:
                    pass

    def detect_vendor_model(self, file_name: str, document_text: str) -> Tuple[str, str]:
        """Scans ingested documents to extract vendor and processor name."""
        combined = (file_name + " " + document_text[:5000]).upper()
        
        # Vendor detection
        detected_vendor = "Other"
        for vendor, domain in AUTHORIZED_DOMAINS.items():
            keyword = vendor.split("/")[0].upper()
            if keyword in combined:
                detected_vendor = vendor
                break

        # Model parsing
        model = "Generic SoC"
        models = [
            r"STM32H7[0-9A-Z]{2,4}", r"STM32F[0-9][0-9A-Z]{2,4}",
            r"IMX8M[A-Z0-9]*", r"IMXRT[0-9]*", r"AM335[0-9]", r"AM64[0-9]",
            r"ZYNQ[- ]?7000", r"ZYNQ[- ]?ULTRASCALE", r"XC7Z[0-9]{3}[A-Z0-9]*",
            r"XCVE[0-9]{4}", r"BCM2711", r"BCM283[57]",
        ]
        for pattern in models:
            match = re.search(pattern, combined)
            if match:
                model = match.group(0)
                break
                
        return detected_vendor, model

    def search_vendor_docs(self, vendor: str, model: str) -> List[Dict[str, str]]:
        """Return only real, pre-registered official vendor sources.

        Never fabricate URLs or register guessed register maps. If the exact
        target is not in the official source manifest, return no documents so
        the caller can require the user to provide the exact device/board or
        upload the vendor package.
        """
        manifest_path = os.path.join(os.path.dirname(__file__), "..", "data", "official_hardware_sources.json")
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            return []

        model_norm = re.sub(r"[^a-z0-9]", "", model.lower())
        hits: List[Dict[str, str]] = []
        for item in manifest.get("documents", []):
            if item.get("vendor", "").lower() != vendor.lower():
                continue
            haystack = " ".join([item.get("product", ""), item.get("board", ""), item.get("part", "")]).lower()
            if model_norm and model_norm not in re.sub(r"[^a-z0-9]", "", haystack):
                continue
            url = item.get("url", "")
            domain = AUTHORIZED_DOMAINS.get(vendor)
            if not domain or domain not in urllib.parse.urlparse(url).netloc:
                continue
            hits.append({
                "title": item["title"],
                "url": url,
                "type": item["type"],
                "version": item.get("revision", "official"),
                "size": item.get("size", "")
            })
        return hits

    def create_and_cache_package(
        self,
        vendor: str,
        model: str,
        version: str,
        urls: List[str]
    ) -> Optional[SupportPackage]:
        """Create a package only from verified evidence.

        This function deliberately does not invent base addresses, IRQs, clocks
        or register offsets. Those values must come from an ingested official
        document, SVD/DTS/XSA/netlist, or explicit user evidence.
        """
        if not urls:
            return None

        package_id = f"{vendor.lower().replace('/', '_')}_{model.lower().replace(' ', '_')}"
        pkg = SupportPackage(
            package_id=package_id,
            vendor=vendor,
            model=model,
            version=version,
            doc_urls=urls,
            peripherals={},
            drivers={},
            clocks={},
            interrupts={},
            register_maps={}
        )
        pkg.save()
        self.packages[package_id] = pkg
        return pkg

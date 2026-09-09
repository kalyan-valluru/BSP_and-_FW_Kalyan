"""
test_rag_pipeline.py
End-to-End RAG Pipeline & Evidence Grounding Verification Suite.
Proves that retrieved knowledge is injected into LLM prompt context
and unsupported missing information is flagged for review.
"""

import os
import sys
import unittest
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from semantic_retriever import (
    DualRepositoryRetriever,
    generate_hardware_retrieval_query,
    get_rag_grounded_context,
    build_grounded_prompt,
    retriever
)
from source_tracer import SourceTracer, TraceRecord
from resolution_engine import UNRESOLVED_VALUE


class TestRAGPipeline(unittest.TestCase):

    def setUp(self):
        # Index mock test data into retriever
        retriever.add_document(
            text="Zynq-7000 TRM UG585: UART0 base address is 0xE0000000 with IRQ 59. UART1 base address is 0xE0001000 with IRQ 82.",
            metadata={"doc_type": "Reference Manual", "vendor": "AMD/Xilinx", "processor": "Zynq-7000"},
            is_vendor_kb=True
        )
        retriever.add_document(
            text="Uploaded Schematic Page 3: UART0 connected to AXI Interconnect at 0xE0000000.",
            metadata={"doc_type": "Board Schematic", "board": "ZC702", "processor": "Cortex-A9"},
            is_vendor_kb=False
        )

    def test_01_query_generation(self):
        ctx = {"processor": "Zynq-7000", "architecture": "Cortex-A9"}
        query = generate_hardware_retrieval_query("UART0", "baseAddress", ctx)
        self.assertIn("Zynq-7000", query)
        self.assertIn("UART0", query)
        self.assertIn("baseAddress", query)
        print("[PASS] Test 1: Query generation validated.")

    def test_02_dual_repository_retrieval(self):
        query = "Zynq-7000 UART0 base address"
        results = retriever.query(query, top_k=4)
        self.assertGreater(len(results), 0)
        
        source_types = [r["source_type"] for r in results]
        self.assertIn("vendor", source_types)
        self.assertIn("project", source_types)

        for r in results:
            self.assertIn("source_document", r)
            self.assertIn("relevance_score", r)
            self.assertIsInstance(r["relevance_score"], float)
        print("[PASS] Test 2: Dual Knowledge retrieval (Vendor vs Project) validated.")

    def test_03_rag_context_grounding_injection(self):
        hardware_ctx = {
            "processor": "Zynq-7000",
            "architecture": "Cortex-A9",
            "peripherals": [{"peripheralBlock": "UART0", "baseAddress": "0xE0000000"}]
        }
        grounded = get_rag_grounded_context(hardware_ctx, top_k=2)
        
        self.assertIn("evidence", grounded)
        self.assertIn("grounded_prompt", grounded)
        
        prompt = grounded["grounded_prompt"]
        self.assertIn("RETRIEVED EVIDENCE GROUNDING:", prompt)
        self.assertIn("[PROJECT KNOWLEDGE EVIDENCE]", prompt)
        self.assertIn("[VENDOR KNOWLEDGE EVIDENCE]", prompt)
        self.assertIn("REASONING INSTRUCTIONS:", prompt)
        print("[PASS] Test 3: RAG Evidence Grounding Prompt Injection validated.")

    def test_04_confidence_and_missing_field_safety(self):
        tracer = SourceTracer()
        tr = tracer.record("UART0", "baseAddress", "0xE0000000", "XSA", confidence=0.96)
        self.assertEqual(tr.value, "0xE0000000")
        self.assertEqual(tr.confidence, 0.96)

        # Missing field safety rule — must return UNRESOLVED_VALUE with score 0.0
        unresolved_tr = tracer.record_unresolved("UART0", "interruptNumber", ["Register Map", "Datasheet"])
        self.assertEqual(unresolved_tr.value, UNRESOLVED_VALUE)
        self.assertEqual(unresolved_tr.confidence, 0.0)
        self.assertEqual(unresolved_tr.hallucination_risk, "high")
        self.assertIn("Unable to determine reliably — user validation required.", unresolved_tr.value)
        print("[PASS] Test 4: Confidence scoring & Missing field safety rules validated.")


if __name__ == "__main__":
    unittest.main()

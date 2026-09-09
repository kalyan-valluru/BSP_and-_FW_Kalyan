import os
import sys
import json
import unittest

# Ensure parent server directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_hardware import (
    analyse_board_image_vision_structured,
    fuse_ocr_and_vision_results,
    extract_image_text,
    parse_hardware_specs
)

class TestVisionOCRPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.real_image_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Demo_Inputs', 'zynq_block_diagram.png')
        cls.has_real_image = os.path.exists(cls.real_image_path)

    def test_01_real_board_image_vision_analysis(self):
        """Test direct multimodal image recognition using Gemini Vision API on real repo image."""
        if not self.has_real_image:
            self.skipTest("Real test image zynq_block_diagram.png not found")

        print("\n--- TEST 1: Real Image Gemini Vision Analysis ---")
        with open(self.real_image_path, 'rb') as f:
            img_bytes = f.read()

        vision_data = analyse_board_image_vision_structured(img_bytes)
        
        if vision_data is not None:
            print("[Test] Vision API returned structured data:")
            print(json.dumps(vision_data, indent=2))
            
            # Verify strict schema fields
            expected_keys = [
                'board_name', 'vendor', 'board_family', 'components',
                'interfaces', 'visible_labels', 'part_numbers', 'confidence',
                'evidence', 'uncertain_fields'
            ]
            for key in expected_keys:
                self.assertIn(key, vision_data, f"Missing expected key: {key}")
            
            self.assertIsInstance(vision_data.get('confidence'), (int, float))
            self.assertIsInstance(vision_data.get('components'), list)
            self.assertIsInstance(vision_data.get('interfaces'), list)
        else:
            print("[Test] Vision API returned None (Fallback mode active)")

    def test_02_ocr_vision_fusion(self):
        """Test combining OCR evidence + Vision API structured JSON into fused Hardware Model."""
        print("\n--- TEST 2: OCR + Vision Results Fusion ---")
        sample_ocr_text = (
            "Zynq-7000 AP SoC Block Diagram\n"
            "Dual ARM Cortex-A9 MPCore\n"
            "UART0 | 0xE0000000 | 59\n"
            "GPIO0 | 0xE000A000 | 52\n"
        )
        sample_vision_data = {
            "board_name": "Zynq-7000 SoC (XC7Z020)",
            "vendor": "Xilinx (AMD)",
            "board_family": "Zynq-7000",
            "components": ["ARM Cortex-A9", "AXI Interconnect", "DDR3 Memory Controller"],
            "interfaces": ["UART", "GPIO", "I2C", "Gigabit Ethernet"],
            "visible_labels": ["U1", "ZYNQ", "XC7Z020"],
            "part_numbers": ["XC7Z020-1CLG484C"],
            "confidence": 0.95,
            "evidence": ["Visible device marking on Zynq chip"],
            "uncertain_fields": []
        }

        fused_model = fuse_ocr_and_vision_results(sample_ocr_text, sample_vision_data)
        print("[Test] Fused Hardware Model output:")
        print(json.dumps(fused_model, indent=2))

        # Assert fused structure integrity
        self.assertIn('ocrEvidence', fused_model)
        self.assertIn('visionEvidence', fused_model)
        self.assertIn('fusedResult', fused_model)
        self.assertEqual(fused_model['ocrEvidence']['source'], 'PaddleOCR')
        self.assertEqual(fused_model['visionEvidence']['source'], 'Gemini Vision API')
        self.assertIn('Zynq-7000', fused_model['fusedResult']['boardCandidate'])
        self.assertEqual(fused_model['vendor'], 'Xilinx (AMD)')
        self.assertEqual(len(fused_model['peripherals']), 2)

    def test_03_vision_failure_fallback(self):
        """Test pipeline resiliency when Vision API is unavailable or fails."""
        print("\n--- TEST 3: Vision API Failure Fallback ---")
        sample_ocr_text = "UART0 | 0xE0000000 | 59"
        
        # Pass None as vision_data to simulate API failure/timeout
        fallback_model = fuse_ocr_and_vision_results(sample_ocr_text, None)
        
        self.assertIsNotNone(fallback_model)
        self.assertEqual(fallback_model['visionEvidence']['status'], 'FAILED/UNAVAILABLE')
        self.assertEqual(fallback_model['ocrEvidence']['source'], 'PaddleOCR')
        # PaddleOCR / specs parser should still succeed without crashing
        self.assertEqual(len(fallback_model['peripherals']), 1)
        print("[Test] Graceful fallback model verified successfully")


if __name__ == '__main__':
    unittest.main()

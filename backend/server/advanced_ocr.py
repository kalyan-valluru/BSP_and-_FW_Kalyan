import os
import sys
import json
import re
import argparse
import time
import math

# Try importing pypdfium2 for native PDF extraction & rendering
try:
    import pypdfium2 as pdfium
    pypdfium2_available = True
except ImportError:
    pypdfium2_available = False

# Try importing Pillow
try:
    from PIL import Image
    pillow_available = True
except ImportError:
    pillow_available = False

# Deterministic schematic image preprocessing. This module never infers hardware facts.
try:
    from schematic_preprocessor import preprocess_image
    preprocessor_available = True
except ImportError:
    preprocess_image = None
    preprocessor_available = False

ENGINEERING_TOKENS = [
    'UART0', 'UART1', 'UART', 'GPIO0', 'GPIO1', 'GPIO',
    'I2C0', 'I2C1', 'I2C', 'SPI0', 'SPI1', 'SPI',
    'CAN0', 'CAN1', 'CAN', 'MMC0', 'MMC1', 'MMC',
    'USB0', 'USB1', 'USB', 'PCIe', 'Ethernet',
    'AXI', 'AHB', 'APB', 'IRQ', 'DMA',
    'TX', 'RX', 'SDA', 'SCL', 'MOSI', 'MISO',
    'CS', 'CLK', 'RESET', 'VCC', 'VDD', '3V3', '1V8', 'GND'
]

TOKEN_NORMALIZATION_MAP = {
    'UARTO': 'UART0', 'UART-0': 'UART0', 'GPIOO': 'GPIO0', 'GPIO-0': 'GPIO0',
    'I2CO': 'I2C0', 'SPIO': 'SPI0', 'MMCO': 'MMC0', 'USBO': 'USB0',
    '12C': 'I2C', '12C0': 'I2C0', 'UAR1': 'UART1', 'SP1': 'SPI',
    'SCL0': 'SCL', 'SDA0': 'SDA',
}

def normalize_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    normalized = raw_text
    for misread, target in TOKEN_NORMALIZATION_MAP.items():
        normalized = re.sub(r'\b' + re.escape(misread) + r'\b', target, normalized, flags=re.IGNORECASE)
    return normalized

def count_engineering_labels(text: str) -> int:
    upper_text = text.upper()
    return sum(len(re.findall(r'\b' + re.escape(token) + r'\b', upper_text)) for token in ENGINEERING_TOKENS)

def extract_native_pdf(file_path: str, output_dir: str):
    if not pypdfium2_available:
        return None
    try:
        doc = pdfium.PdfDocument(file_path)
        page_count = len(doc)
        pages_data, total_text_blocks, total_eng_labels = [], 0, 0
        for page_idx in range(page_count):
            page = doc[page_idx]
            width, height = page.get_size()
            textpage = page.get_textpage()
            text = textpage.get_text_range() or ""
            blocks = []
            if text.strip():
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                for idx, line in enumerate(lines):
                    norm = normalize_text(line)
                    total_eng_labels += count_engineering_labels(norm)
                    blocks.append({"text": line, "rawText": line, "normalizedText": norm,
                                   "bbox": [10, idx * 20, int(width) - 10, (idx + 1) * 20],
                                   "confidence": 0.99, "source": "native_pdf"})
            total_text_blocks += len(blocks)
            pages_data.append({"pageNumber": page_idx + 1, "width": int(width), "height": int(height),
                               "textBlocks": blocks, "tables": [],
                               "regions": [{"type": "text_column", "bbox": [0, 0, int(width), int(height)], "confidence": 0.99}] if blocks else [],
                               "readingOrder": list(range(len(blocks)))})
        is_sufficient = total_text_blocks > 5 and (total_eng_labels > 0 or page_count <= 2)
        if not is_sufficient:
            return None
        return {"document": file_path, "pageCount": page_count, "strategy": "native_pdf_text",
                "engine": "PyPDFium2 Native Extractor", "pages": pages_data,
                "totalTextBlocks": total_text_blocks, "totalTables": 0,
                "engineeringLabelsCount": total_eng_labels, "averageConfidence": 0.99, "success": True}
    except Exception as e:
        sys.stderr.write(f"[OCR] Native PDF extraction failed: {e}\n")
        return None

def _prepare_image(img_path: str, output_dir: str, page_num: int):
    if not preprocessor_available or preprocess_image is None:
        return img_path, {"applied": False, "reason": "preprocessor_unavailable"}
    try:
        stem = f"_preprocessed_page_{page_num}.png"
        out = os.path.join(output_dir, stem)
        processed, metadata = preprocess_image(img_path, out)
        if metadata.get("applied"):
            sys.stderr.write(f"[PREPROCESS] Page {page_num}: {metadata['operations']} deskew={metadata.get('deskewDegrees', 0)}\n")
        return processed, metadata
    except Exception as exc:
        sys.stderr.write(f"[PREPROCESS] Page {page_num} skipped: {exc}\n")
        return img_path, {"applied": False, "reason": "preprocess_error"}

def process_with_paddleocr(file_path: str, output_dir: str, prefer_vl: bool = False):
    try:
        from paddleocr import PaddleOCR, PaddleOCRVL
    except ImportError as e:
        sys.stderr.write(f"[OCR] PaddleOCR import failed: {e}\n")
        return None

    os.makedirs(output_dir, exist_ok=True)
    temp_images = []
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        if not pypdfium2_available:
            return None
        doc = pdfium.PdfDocument(file_path)
        page_count = len(doc)
        for i in range(page_count):
            image = doc[i].render(scale=2).to_pil()
            raw_path = os.path.join(output_dir, f"_temp_page_{i+1}.png")
            image.save(raw_path)
            processed_path, prep = _prepare_image(raw_path, output_dir, i + 1)
            temp_images.append((i + 1, raw_path, processed_path, image.width, image.height, prep))
    else:
        if pillow_available:
            img = Image.open(file_path)
            processed_path, prep = _prepare_image(file_path, output_dir, 1)
            temp_images.append((1, file_path, processed_path, img.width, img.height, prep))
        else:
            temp_images.append((1, file_path, file_path, 1000, 1000, {"applied": False, "reason": "pillow_unavailable"}))
        page_count = 1

    engine = None
    engine_name = "PaddleOCR-VL" if prefer_vl else "PP-StructureV3"
    strategy_name = "paddleocr_vl" if prefer_vl else "pp_structure_v3"
    try:
        if prefer_vl:
            try:
                engine = PaddleOCRVL()
            except Exception as e_vl:
                sys.stderr.write(f"[OCR] PaddleOCRVL initialization failed ({e_vl}), using PaddleOCR standard.\n")
                engine = PaddleOCR(lang='en')
                engine_name, strategy_name = "PaddleOCR", "paddle_ocr_standard"
        else:
            engine = PaddleOCR(lang='en')
            engine_name, strategy_name = "PaddleOCR", "paddle_ocr_standard"
    except Exception as e:
        sys.stderr.write(f"[OCR] PaddleOCR initialization failed completely: {e}\n")
        return None

    pages_data, total_text_blocks = [], 0
    total_tables = total_eng_labels = 0
    total_confidence_sum = total_confidence_count = 0

    for page_num, raw_path, img_path, width, height, prep in temp_images:
        blocks, tables, regions = [], [], []
        try:
            results = engine.predict(img_path) if hasattr(engine, 'predict') else engine.ocr(img_path)
            if results:
                res_list = results if isinstance(results, list) else [results]
                for item in res_list:
                    if hasattr(item, 'rec_texts') or (isinstance(item, dict) and 'rec_texts' in item):
                        rec_texts = item.rec_texts if hasattr(item, 'rec_texts') else item.get('rec_texts', [])
                        rec_scores = item.rec_scores if hasattr(item, 'rec_scores') else item.get('rec_scores', [])
                        dt_polys = item.dt_polys if hasattr(item, 'dt_polys') else item.get('dt_polys', [])
                        rec_boxes = item.rec_boxes if hasattr(item, 'rec_boxes') else item.get('rec_boxes', [])
                        for idx, txt in enumerate(rec_texts):
                            txt_str = str(txt).strip()
                            if not txt_str: continue
                            conf = float(rec_scores[idx]) if idx < len(rec_scores) else 0.90
                            box = [0, 0, width, height]
                            if idx < len(dt_polys):
                                poly = dt_polys[idx]
                                xs, ys = [pt[0] for pt in poly], [pt[1] for pt in poly]
                                box = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
                            elif idx < len(rec_boxes):
                                b = rec_boxes[idx]
                                box = [int(b[0]), int(b[1]), int(b[2]), int(b[3])]
                            norm = normalize_text(txt_str)
                            total_eng_labels += count_engineering_labels(norm)
                            blocks.append({"text": txt_str, "rawText": txt_str, "normalizedText": norm,
                                           "bbox": box, "confidence": round(conf, 4), "source": strategy_name})
                            total_confidence_sum += conf; total_confidence_count += 1
                            regions.append({"type": "text", "bbox": box, "confidence": round(conf, 4)})
                    elif isinstance(item, list):
                        for line in item:
                            if isinstance(line, list) and len(line) >= 2 and isinstance(line[1], (tuple, list)):
                                box_pts, txt = line[0], str(line[1][0]).strip()
                                if not txt: continue
                                c = float(line[1][1]); norm = normalize_text(txt)
                                xs, ys = [pt[0] for pt in box_pts], [pt[1] for pt in box_pts]
                                box = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
                                total_eng_labels += count_engineering_labels(norm)
                                blocks.append({"text": txt, "rawText": txt, "normalizedText": norm,
                                               "bbox": box, "confidence": round(c, 4), "source": strategy_name})
                                total_confidence_sum += c; total_confidence_count += 1
                                regions.append({"type": "text", "bbox": box, "confidence": round(c, 4)})
        except Exception as err:
            sys.stderr.write(f"[OCR] Error processing page {page_num}: {err}\n")
        total_text_blocks += len(blocks)
        pages_data.append({"pageNumber": page_num, "width": width, "height": height, "textBlocks": blocks,
                           "tables": tables, "regions": regions, "readingOrder": list(range(len(blocks))),
                           "preprocessing": prep})
        if ext == '.pdf':
            for candidate in (raw_path, img_path):
                if candidate != file_path and os.path.exists(candidate):
                    try: os.remove(candidate)
                    except Exception: pass

    avg_conf = total_confidence_sum / total_confidence_count if total_confidence_count else 0.0
    return {"document": file_path, "pageCount": page_count, "strategy": strategy_name, "engine": engine_name,
            "pages": pages_data, "totalTextBlocks": total_text_blocks, "totalTables": total_tables,
            "engineeringLabelsCount": total_eng_labels, "averageConfidence": round(avg_conf, 4),
            "success": total_text_blocks > 0 or total_tables > 0 or total_eng_labels > 0}

def main():
    parser = argparse.ArgumentParser(description="Advanced Engineering Document OCR Bridge")
    parser.add_argument("--inputPath", required=True)
    parser.add_argument("--outputDir", required=True)
    parser.add_argument("--strategy", default="auto", choices=["auto", "native", "pp_structure_v3", "paddleocr_vl"])
    args = parser.parse_args()
    input_path, output_dir = os.path.abspath(args.inputPath), os.path.abspath(args.outputDir)
    os.makedirs(output_dir, exist_ok=True)
    if not os.path.exists(input_path):
        print(json.dumps({"success": False, "error": f"Input file not found: {input_path}"})); sys.exit(1)
    doc_json = None
    if args.strategy in ["auto", "native"] and input_path.lower().endswith(".pdf"):
        doc_json = extract_native_pdf(input_path, output_dir)
    if not doc_json:
        doc_json = process_with_paddleocr(input_path, output_dir, prefer_vl=(args.strategy == "paddleocr_vl"))
    if doc_json and doc_json.get("success"):
        with open(os.path.join(output_dir, "document_ocr.json"), "w", encoding="utf-8") as f:
            json.dump(doc_json, f, indent=2)
        for page in doc_json.get("pages", []):
            with open(os.path.join(output_dir, f"page_{page['pageNumber']:03d}_ocr.json"), "w", encoding="utf-8") as f:
                json.dump(page, f, indent=2)
        print(json.dumps(doc_json, indent=2)); sys.exit(0)
    print(json.dumps({"document": input_path, "pageCount": 0, "strategy": args.strategy,
                      "engine": "None", "pages": [], "totalTextBlocks": 0, "totalTables": 0,
                      "engineeringLabelsCount": 0, "averageConfidence": 0.0, "success": False,
                      "error": "No meaningful document content extracted."}, indent=2))
    sys.exit(1)

if __name__ == "__main__":
    main()

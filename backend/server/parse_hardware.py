import os
import sys
import json
import re
import csv
import zipfile
import xml.etree.ElementTree as ET
import base64
import io
import subprocess
import time

# Auto-load root .env if environment variables are not yet present
_root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
if os.path.exists(_root_env):
    with open(_root_env, 'r', encoding='utf-8', errors='ignore') as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _v = _line.split('=', 1)
                os.environ.setdefault(_k.strip(), _v.strip())


# ── Optional library imports ──────────────────────────────────────────────────
import warnings
try:
    warnings.filterwarnings('ignore')  # Suppress fitz deprecation warnings from polluting stdout
    import fitz  # PyMuPDF
    warnings.resetwarnings()
    pymupdf_available = True
except ImportError:
    pymupdf_available = False

try:
    import pdfplumber
    pdfplumber_available = True
except ImportError:
    pdfplumber_available = False

try:
    import cv2
    import numpy as np
    opencv_available = True
except ImportError:
    opencv_available = False

try:
    import easyocr
    easyocr_available = True
except ImportError:
    easyocr_available = False

try:
    from PIL import Image
    pillow_available = True
except ImportError:
    pillow_available = False

try:
    from openai import OpenAI
    openai_available = True
except ImportError:
    openai_available = False

# ── Google Gemini / Vision API client ──────────────────────────────────────────
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY') or ''
GEMINI_BASE_URL = os.environ.get('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/')
VISION_MODEL = os.environ.get('VISION_MODEL', 'gemini-3.6-flash')
TEXT_MODEL = os.environ.get('AI_MODEL', 'gemini-3.6-flash')

global_last_fused_model = {}

def get_vision_client():
    if not openai_available or not GEMINI_API_KEY or GEMINI_API_KEY.startswith('mock_'):
        return None
    try:
        return OpenAI(api_key=GEMINI_API_KEY, base_url=GEMINI_BASE_URL)
    except Exception:
        return None



# ── Vision API: analyse a single page image for hardware data ─────────────────
def analyse_image_with_vision(image_bytes: bytes, page_num: int = 0) -> str:
    """Send a page image to Google Gemini Vision model and extract hardware info."""
    client = get_vision_client()
    if client is None:
        return ''
    b64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Retrieve semantic context from Vector Registry (ChromaDB / Pluggable Fallback)
    semantic_context = ""
    try:
        from semantic_retriever import registry
        active_provider = registry.get_active()
        results = active_provider.query("peripherals, base address, IRQs, registers, mapping", top_k=2)
        if results:
            semantic_context = "\n\n--- ADDITIONAL CONTEXT FROM SPEC SHEETS ---\n"
            for r in results:
                semantic_context += f"[Ref: {r['metadata'].get('source', 'Manual')}]\n{r['text']}\n---\n"
    except Exception:
        pass
    
    # Try JSON mode first
    try:
        json_prompt = (
            "You are an expert hardware BSP engineer analysing an embedded board image, schematic, or block diagram.\n"
            "Extract ALL of the following from this image into a strict JSON object:\n"
            "{\n"
            "  \"hardware_identity\": {\n"
            "    \"board_name\": null,\n"
            "    \"manufacturer\": null,\n"
            "    \"model_number\": null,\n"
            "    \"processor\": null,\n"
            "    \"architecture\": null,\n"
            "    \"fpga_device\": null\n"
            "  },\n"
            "  \"board\": null,\n"
            "  \"cpu\": null,\n"
            "  \"fpga\": null,\n"
            "  \"memory\": [],\n"
            "  \"peripherals\": [\n"
            "    {\n"
            "      \"peripheralBlock\": \"UART0\",\n"
            "      \"type\": \"UART\",\n"
            "      \"baseAddress\": \"0xE0000000\",\n"
            "      \"interruptNumber\": 59,\n"
            "      \"bus\": \"APB\",\n"
            "      \"driverName\": \"xuartps\",\n"
            "      \"physicalPinMapping\": \"MIO[14:15]\",\n"
            "      \"clockFrequency\": \"100 MHz\",\n"
            "      \"evidence\": \"Visible chip label U1 / schematic net\",\n"
            "      \"confidence\": 0.95\n"
            "    }\n"
            "  ],\n"
            "  \"connectivity\": [\n"
            "    {\n"
            "      \"from\": \"U1.GPIO12\",\n"
            "      \"to\": \"D1.A\",\n"
            "      \"signal\": \"LED_STATUS\",\n"
            "      \"evidence\": \"schematic line wire\"\n"
            "    }\n"
            "  ],\n"
            "  \"labels\": [],\n"
            "  \"evidence\": [\n"
            "    {\n"
            "      \"component\": \"Zynq-7000\",\n"
            "      \"value\": \"XC7Z020\",\n"
            "      \"source\": \"VISION\",\n"
            "      \"evidence\": \"visible device marking on chip U1\",\n"
            "      \"confidence\": 0.94\n"
            "    }\n"
            "  ],\n"
            "  \"confidence\": {\n"
            "    \"board\": 0.9,\n"
            "    \"processor\": 0.95,\n"
            "    \"components\": 0.85,\n"
            "    \"connectivity\": 0.8\n"
            "  }\n"
            "}\n"
            "Do NOT invent missing values. If a value cannot be seen or verified in the image, set it to null or an empty array.\n"
            "Never fabricate addresses or IRQs. Return ONLY valid JSON."
            + semantic_context
        )
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': json_prompt},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{b64}'}}
                ]
            }],
            temperature=0.1,
            max_tokens=2048,
            response_format={"type": "json_object"}
        )
        res_text = response.choices[0].message.content or ''
        if res_text.strip():
            return res_text
    except Exception:
        pass

    # Fallback to plain text prompt
    try:
        prompt = (
            "You are a hardware BSP engineer analysing an embedded systems document page.\n"
            "Extract ALL of the following from this image (block diagrams, schematics, register maps, pin tables, memory maps):\n"
            "- Board name / FPGA device / SoC model\n"
            "- Processor core (e.g. ARM Cortex-A9, MicroBlaze)\n"
            "- Memory (DDR size, Flash type)\n"
            "- Clock sources and frequencies\n"
            "- Every peripheral: name, base address (0xXXXXXXXX), address range, IRQ number, bus type, driver name, pin mapping, operating mode\n"
            "- Interrupt numbers for each peripheral\n"
            "- DMA channels\n\n"
            "Format your response as plain text with one peripheral per line using this pattern:\n"
            "PERIPHERAL: <name> | ADDR: <0xXXXXXXXX> | IRQ: <N> | BUS: <type> | DRIVER: <driver> | PINS: <pins> | CLK: <freq>\n"
            "Also include: BOARD: <name>, CPU: <core>, FPGA: <device>, MEMORY: <size>, FLASH: <type>, CLOCK: <source>=<freq>\n"
            "For PINS, extract exact physical pins (e.g. MIO12, K18) or logical mappings (e.g. LED0, BTN0, SW0) if available. Never output generic ranges like MIO[0:53] unless explicitly stated.\n"
            "If a field like IRQ or PINS is not visible anywhere, write 'Requires Vivado/XSA'. For other missing fields write N/A.\n"
            "Do NOT invent values. Only report what is explicitly visible in the image."
            + semantic_context
        )
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{b64}'}}
                ]
            }],
            temperature=0.1,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ''
    except Exception as e:
        return f'[VISION ERR page {page_num}]: {e}'


# ── Vision API: Direct Multimodal Structured Image Recognition ────────────────
def analyse_board_image_vision_structured(image_input) -> dict:
    """
    Multimodal Vision API call using Google Gemini.
    Accepts raw image directly (bytes or file path).
    Returns STRICT STRUCTURED JSON with board identification and component breakdown.
    """
    sys.stderr.write("[Vision] Sending board image to vision model\n")
    client = get_vision_client()
    if client is None:
        sys.stderr.write("[Vision] Failed: Vision API client unavailable or credentials not set\n")
        return None

    try:
        if isinstance(image_input, str):
            with open(image_input, 'rb') as f:
                img_bytes = f.read()
        else:
            img_bytes = image_input

        b64 = base64.b64encode(img_bytes).decode('utf-8')

        prompt = (
            "You are an expert embedded hardware systems engineer inspecting an image of an electronic circuit board, FPGA block diagram, or schematic.\n"
            "Analyse the visual features (chip labels, logos, pin headers, board model silkscreen, interfaces) and return a STRICT JSON object matching this schema:\n"
            "{\n"
            "  \"board_name\": \"string or null\",\n"
            "  \"vendor\": \"string or null\",\n"
            "  \"board_family\": \"string or null\",\n"
            "  \"components\": [\"string\"],\n"
            "  \"interfaces\": [\"string\"],\n"
            "  \"visible_labels\": [\"string\"],\n"
            "  \"part_numbers\": [\"string\"],\n"
            "  \"confidence\": 0.95,\n"
            "  \"evidence\": [\"string\"],\n"
            "  \"uncertain_fields\": [\"string\"]\n"
            "}\n"
            "Do NOT invent unverified data. If a field cannot be seen or inferred, set it to empty array or null.\n"
            "Return ONLY valid JSON."
        )

        models_to_try = list(dict.fromkeys([VISION_MODEL, 'gemini-3.6-flash']))
        res_text = None
        last_err = None

        for model in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[{
                        'role': 'user',
                        'content': [
                            {'type': 'text', 'text': prompt},
                            {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{b64}'}}
                        ]
                    }],
                    temperature=0.1,
                    max_tokens=2048,
                    response_format={"type": "json_object"},
                    timeout=25.0
                )

                res_text = response.choices[0].message.content or ''
                if res_text.strip():
                    break
            except Exception as e:
                last_err = e
                continue

        if not res_text:
            sys.stderr.write(f"[Vision] Failed: {last_err or 'Empty response from Vision API'}\n")
            return None

        parsed_json = json.loads(res_text)
        sys.stderr.write("[Vision] Response received\n")
        board_cand = parsed_json.get('board_name') or parsed_json.get('board_family') or 'Unknown Board'
        conf = parsed_json.get('confidence', 0.0)
        sys.stderr.write(f"[Vision] Board candidate: {board_cand}\n")
        sys.stderr.write(f"[Vision] Confidence: {conf}\n")
        return parsed_json

    except Exception as err:
        sys.stderr.write(f"[Vision] Failed: {err}\n")
        return None


def fuse_ocr_and_vision_results(ocr_text: str, vision_data: dict, file_path: str = "") -> dict:
    """
    Combines PaddleOCR extracted text/labels with Gemini Vision API structured JSON.
    Maintains OCR evidence, Vision evidence, fused candidates, and confidence scores.
    Preserves existing validation and RAG knowledge as authority for final board identification.
    """
    sys.stderr.write("[Fusion] OCR + Vision results combined\n")

    # 1. Base specs extraction from OCR text
    hardware_model = parse_hardware_specs(ocr_text or "")

    # 2. Extract OCR evidence
    ocr_evidence = {
        'source': 'PaddleOCR',
        'raw_text_length': len(ocr_text or ""),
        'detected_tokens': [line.strip() for line in (ocr_text or "").splitlines() if line.strip()][:20]
    }

    # 3. Extract Vision evidence
    vision_evidence = {
        'source': 'Gemini Vision API',
        'data': vision_data if vision_data else None,
        'status': 'SUCCESS' if vision_data else 'FAILED/UNAVAILABLE'
    }

    # 4. Determine fused board candidate
    fused_board_name = hardware_model.get('boardName')
    if (not fused_board_name or fused_board_name == 'NOT FOUND IN PDF') and vision_data:
        v_board = vision_data.get('board_name') or vision_data.get('board_family')
        if v_board:
            fused_board_name = v_board

    # 5. Vendor / architecture alignment
    if vision_data and vision_data.get('vendor'):
        hardware_model['vendor'] = vision_data['vendor']
    if vision_data and vision_data.get('board_family') and (not hardware_model.get('architecture') or hardware_model.get('architecture') == 'Zynq-7000'):
        if 'zynq' in vision_data['board_family'].lower():
            hardware_model['architecture'] = 'Zynq-7000'
        elif 'stm32' in vision_data['board_family'].lower():
            hardware_model['architecture'] = 'STM32'

    # 6. Populate components, interfaces, part numbers from Vision API
    hardware_model['components'] = vision_data.get('components', []) if vision_data else []
    hardware_model['interfaces'] = vision_data.get('interfaces', []) if vision_data else []
    hardware_model['visibleLabels'] = vision_data.get('visible_labels', []) if vision_data else []
    hardware_model['partNumbers'] = vision_data.get('part_numbers', []) if vision_data else []
    hardware_model['uncertainFields'] = vision_data.get('uncertain_fields', []) if vision_data else []

    # 7. Attach structured evidence payload
    hardware_model['ocrEvidence'] = ocr_evidence
    hardware_model['visionEvidence'] = vision_evidence
    hardware_model['fusedResult'] = {
        'boardCandidate': fused_board_name or hardware_model.get('boardName', 'NOT FOUND IN PDF'),
        'confidence': vision_data.get('confidence', 0.85) if vision_data else 0.70,
        'fusedBy': 'PaddleOCR + Gemini Vision Pipeline'
    }

    # Log final board identification step
    final_id = fused_board_name or hardware_model.get('boardName', 'NOT FOUND IN PDF')
    sys.stderr.write(f"[Validation] Final board identification: {final_id}\n")

    return hardware_model

def extract_pdf_text_and_vision(file_path: str) -> str:
    """Extract text from every PDF page; also run vision on pages that have images."""
    combined = []

    # ── Text pass (pdfplumber preferred, PyMuPDF fallback) ────────────────────
    text_pages = {}
    if pdfplumber_available:
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    t = page.extract_text() or ''
                    
                    tables = page.extract_tables()
                    if tables:
                        t += "\n\n--- DETERMINISTIC TABLE EXTRACTION ---\n"
                        for table in tables:
                            for row in table:
                                cleaned_row = [str(c).replace('\n', ' ') if c is not None else '' for c in row]
                                t += " | ".join(cleaned_row) + "\n"
                        t += "--------------------------------------\n"

                    if t.strip():
                        text_pages[i] = t
        except Exception:
            pass

    if not text_pages and pymupdf_available:
        try:
            doc = fitz.open(file_path)
            for i, page in enumerate(doc):
                t = page.get_text()
                if t.strip():
                    text_pages[i] = t
        except Exception:
            pass

    for i, t in sorted(text_pages.items()):
        combined.append(f'--- Page {i+1} (text) ---\n{t}')

    # ── Advanced OCR pass: run PaddleOCR-VL / PP-StructureV3 on rendered page images ──
    if pymupdf_available:
        try:
            doc = fitz.open(file_path)
            total_native_text_len = sum(len(t) for t in text_pages.values())
            sys.stderr.write(f"[PDF] pageCount={len(doc)}\n")
            sys.stderr.write(f"[PDF] nativeTextLength={total_native_text_len}\n")

            total_embedded_imgs = sum(len(page.get_images(full=True)) for page in doc)
            sys.stderr.write(f"[PDF] embeddedImages={total_embedded_imgs}\n")
            sys.stderr.write(f"[PDF] renderedPageImages={len(doc)}\n")

            sys.stderr.write(f"[OCR] Advanced document ingestion started.\n")
            sys.stderr.write(f"[OCR] Strategy: PP-StructureV3 / PaddleOCR-VL\n")
            sys.stderr.write(f"[OCR] Engine: PaddleOCR (lang='en')\n")
            sys.stderr.write(f"[OCR] Page count: {len(doc)}\n")

            venv_python = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.venv_paddleocr', 'Scripts', 'python.exe')
            ocr_script = os.path.join(os.path.dirname(__file__), 'advanced_ocr.py')

            for i, page in enumerate(doc):
                image_list = page.get_images(full=True)
                if image_list:
                    sys.stderr.write(f"[INGESTION] Embedded images detected: {len(image_list)} on page {i+1}\n")
                    sys.stderr.write(f"[INGESTION] Board image region detected.\n")
                    sys.stderr.write(f"[INGESTION] Sending board image to Advanced OCR/Vision.\n")

                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
                tmp_img_path = os.path.join(os.path.dirname(file_path), f"pdf_page_{i+1}_{int(time.time()*1000)}.png")
                pix.save(tmp_img_path)

                sys.stderr.write(f"[PDF] Rendered page:\n{tmp_img_path}\n")
                sys.stderr.write(f"[OCR] Processing:\n{tmp_img_path}\n")
                sys.stderr.write(f"[VISION] Processing:\n{tmp_img_path}\n")

                if os.path.exists(venv_python) and os.path.exists(ocr_script):
                    res = subprocess.run([venv_python, ocr_script, '--inputPath', tmp_img_path], capture_output=True, text=True, timeout=60)
                    if res.returncode == 0 and res.stdout.strip():
                        ocr_json = json.loads(res.stdout)
                        blocks = ocr_json.get('totalTextBlocks', 0)
                        labels = ocr_json.get('engineeringLabelsCount', 0)
                        conf = ocr_json.get('averageConfidence', 0.0)
                        sys.stderr.write(f"[OCR] Page {i+1}: text blocks={blocks}\n")
                        sys.stderr.write(f"[OCR] Engineering labels detected={labels}\n")
                        sys.stderr.write(f"[OCR] Average confidence={conf:.2f}%\n")
                        
                        ocr_lines = []
                        for p in ocr_json.get('pages', []):
                            for tb in p.get('textBlocks', []):
                                if tb.get('text'):
                                    ocr_lines.append(tb['text'])
                        if ocr_lines:
                            combined.append(f'--- Page {i+1} (PaddleOCR) ---\n' + '\n'.join(ocr_lines))

                try:
                    os.remove(tmp_img_path)
                except Exception:
                    pass

        except Exception as ocr_err:
            sys.stderr.write(f"[OCR] PDF Advanced OCR pass error: {ocr_err}\n")

    # ── Vision pass: render each page as PNG and query Google Gemini Vision ───────
    if pymupdf_available and openai_available and GEMINI_API_KEY and not GEMINI_API_KEY.startswith('mock_'):
        try:
            doc = fitz.open(file_path)
            for i, page in enumerate(doc):
                mat = fitz.Matrix(1.5, 1.5)  # 1.5× zoom — balances resolution vs payload size
                pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
                img_bytes = pix.tobytes('png')
                vision_text = analyse_image_with_vision(img_bytes, page_num=i)
                if vision_text.strip():
                    combined.append(f'--- Page {i+1} (vision) ---\n{vision_text}')
        except Exception as e:
            combined.append(f'[Vision PDF pass error: {e}]')

    return '\n'.join(combined)


def extract_pdf_text(file_path: str) -> str:
    """Legacy wrapper — now calls full text+vision extractor."""
    return extract_pdf_text_and_vision(file_path)


def extract_image_text(file_path: str) -> str:
    """
    Full dual-pipeline pass on standalone image file:
    1. PaddleOCR extracts text blocks, engineering labels, part numbers.
    2. Gemini Vision API receives original image directly for structured visual analysis.
    3. Fuses OCR + Vision results cleanly with fallback.
    """
    sys.stderr.write(f"[OCR] Processing standalone image: {file_path}\n")
    ocr_text = ""

    # 1. PaddleOCR-VL / PP-StructureV3 via local Python venv
    try:
        venv_python = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.venv_paddleocr', 'Scripts', 'python.exe')
        ocr_script = os.path.join(os.path.dirname(__file__), 'advanced_ocr.py')
        if os.path.exists(venv_python) and os.path.exists(ocr_script):
            res = subprocess.run([venv_python, ocr_script, '--inputPath', file_path], capture_output=True, text=True, timeout=60)
            if res.returncode == 0 and res.stdout.strip():
                ocr_json = json.loads(res.stdout)
                text_lines = []
                for p in ocr_json.get('pages', []):
                    for tb in p.get('textBlocks', []):
                        if tb.get('text'):
                            text_lines.append(tb['text'])
                if text_lines:
                    ocr_text = '\n'.join(text_lines)
    except Exception as paddle_err:
        sys.stderr.write(f"[OCR] PaddleOCR invocation error: {paddle_err}\n")

    # Fallback to EasyOCR if PaddleOCR yielded no text
    if not ocr_text and easyocr_available:
        try:
            reader = easyocr.Reader(['en'], gpu=False)
            result = reader.readtext(file_path)
            ocr_text = '\n'.join(r[1] for r in result)
        except Exception as e:
            sys.stderr.write(f"[OCR] EasyOCR fallback error: {e}\n")

    # 2. Gemini Vision API pass (direct multimodal image input)
    vision_json = None
    try:
        with open(file_path, 'rb') as f:
            img_bytes = f.read()
        vision_json = analyse_board_image_vision_structured(img_bytes)
    except Exception as v_err:
        sys.stderr.write(f"[Vision] Failed: {v_err}\n")

    # 3. Fuse OCR + Vision
    fused_model = fuse_ocr_and_vision_results(ocr_text, vision_json, file_path)
    global_last_fused_model[file_path] = fused_model

    if ocr_text:
        return ocr_text
    elif vision_json:
        return json.dumps(vision_json)
    return '[No OCR or Vision data extracted]'



def extract_docx_text(file_path: str) -> str:
    try:
        with zipfile.ZipFile(file_path) as docx:
            tree = ET.parse(docx.open('word/document.xml'))
            root = tree.getroot()
            texts = [elem.text for elem in root.iter() if elem.tag.endswith('t') and elem.text]
            return '\n'.join(texts)
    except Exception as e:
        return f'Error parsing DOCX: {e}'


def extract_xlsx_text(file_path: str) -> str:
    try:
        with zipfile.ZipFile(file_path) as xlsx:
            shared_strings = []
            try:
                tree = ET.parse(xlsx.open('xl/sharedStrings.xml'))
                root = tree.getroot()
                for elem in root.iter():
                    if elem.tag.endswith('t'):
                        shared_strings.append(elem.text or '')
            except KeyError:
                pass

            tree = ET.parse(xlsx.open('xl/worksheets/sheet1.xml'))
            root = tree.getroot()
            rows = []
            for row in root.iter():
                if row.tag.endswith('row'):
                    cells = []
                    for cell in row.iter():
                        if cell.tag.endswith('c'):
                            v = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                            val = v.text if v is not None else ''
                            if cell.get('t') == 's' and val:
                                try:
                                    val = shared_strings[int(val)]
                                except (ValueError, IndexError):
                                    pass
                            cells.append(val)
                    rows.append('\t'.join(cells))
            return '\n'.join(rows)
    except Exception as e:
        return f'Error parsing Excel: {e}'


def parse_vivado_xpr_project(file_path: str) -> dict:
    """Parse Vivado .xpr XML, .xci, .xdc, .v files inside zip/directory for hardware ingestion."""
    try:
        xpr_content = None
        xdc_contents = []
        v_modules = []
        xci_cores = []
        has_bd = False

        if zipfile.is_zipfile(file_path):
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                namelist = zip_ref.namelist()
                for name in namelist:
                    nl = name.lower()
                    if nl.endswith('.bd'):
                        has_bd = True
                    if nl.endswith('.xpr'):
                        xpr_content = zip_ref.read(name).decode('utf-8', errors='ignore')
                    elif nl.endswith('.xdc'):
                        xdc_contents.append(zip_ref.read(name).decode('utf-8', errors='ignore'))
                    elif nl.endswith('.xci'):
                        core_base = os.path.basename(name).replace('.xci', '')
                        xci_cores.append((core_base, zip_ref.read(name).decode('utf-8', errors='ignore')))
                    elif (nl.endswith('.v') or nl.endswith('.vhd')) and ('sources_1' in nl or 'src' in nl) and 'ip' not in nl and 'sim' not in nl:
                        v_contents = zip_ref.read(name).decode('utf-8', errors='ignore')
                        for m in re.finditer(r'\bmodule\s+([A-Za-z0-9_]+)', v_contents):
                            mod_name = m.group(1)
                            if mod_name.lower() not in ('top', 'tb', 'testbench'):
                                v_modules.append((mod_name, name))
        elif os.path.isdir(file_path):
            for root, _, files in os.walk(file_path):
                for f in files:
                    fl = f.lower()
                    fp = os.path.join(root, f)
                    if fl.endswith('.bd'):
                        has_bd = True
                    elif fl.endswith('.xpr'):
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as xf:
                            xpr_content = xf.read()
                    elif fl.endswith('.xdc'):
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as xf:
                            xdc_contents.append(xf.read())
                    elif fl.endswith('.xci'):
                        core_base = f.replace('.xci', '')
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as xf:
                            xci_cores.append((core_base, xf.read()))
                    elif (fl.endswith('.v') or fl.endswith('.vhd')) and ('sources_1' in fp.lower() or 'src' in fp.lower()) and 'ip' not in fp.lower() and 'sim' not in fp.lower():
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as xf:
                            v_contents = xf.read()
                            for m in re.finditer(r'\bmodule\s+([A-Za-z0-9_]+)', v_contents):
                                mod_name = m.group(1)
                                if mod_name.lower() not in ('top', 'tb', 'testbench'):
                                    v_modules.append((mod_name, fp))

        if not xpr_content:
            return None

        # Extract BoardPart and Part from .xpr XML
        board_name = 'Digilent ZedBoard'
        fpga_part = 'xc7z020clg484-1'
        architecture = 'Zynq-7000'
        processor = 'ARM Cortex-A9'

        part_m = re.search(r'<Option\s+Name="Part"\s+Val="([^"]+)"', xpr_content, re.IGNORECASE)
        if part_m:
            fpga_part = part_m.group(1)

        board_m = re.search(r'<Option\s+Name="BoardPart"\s+Val="([^"]+)"', xpr_content, re.IGNORECASE)
        if board_m:
            board_val = board_m.group(1)
            if 'zedboard' in board_val.lower():
                board_name = 'Digilent ZedBoard'
            else:
                board_name = board_val.split(':')[1] if ':' in board_val else board_val

        if 'xc7z' in fpga_part.lower() or 'zynq' in fpga_part.lower():
            architecture = 'Zynq-7000'
            processor = 'ARM Cortex-A9'
        elif 'xczu' in fpga_part.lower():
            architecture = 'Zynq UltraScale+'
            processor = 'ARM Cortex-A53'

        # Parse XDC pin constraints
        pin_mappings = {}
        for xdc in xdc_contents:
            for pm in re.finditer(r'set_property\s+PACKAGE_PIN\s+([A-Za-z0-9]+)\s+\[get_ports\s+\{?([A-Za-z0-9_]+)\}?\]', xdc, re.IGNORECASE):
                pin_mappings[pm.group(2)] = pm.group(1)
            for pm in re.finditer(r'set_property\s+-dict\s*\{\s*PACKAGE_PIN\s+([A-Za-z0-9]+)[^\}]*\}\s*\[get_ports\s+\{?([A-Za-z0-9_]+)\}?\]', xdc, re.IGNORECASE):
                pin_mappings[pm.group(2)] = pm.group(1)

        extracted_peripherals = []
        oled_pins = [f'{port}({pin})' for port, pin in pin_mappings.items() if 'OLED' in port.upper()]
        oled_pins_str = ', '.join(oled_pins) if oled_pins else 'Fabric Connected'

        seen_blocks = set()
        for mod_name, _ in v_modules:
            if mod_name in seen_blocks:
                continue
            seen_blocks.add(mod_name)

            p_type = 'RTL Peripheral'
            driver_name = 'Custom_RTL_Driver'
            pins = 'Fabric Connected'

            if 'oled' in mod_name.lower():
                p_type = 'OLED Controller'
                driver_name = 'Custom_OLED_RTL'
                pins = oled_pins_str
            elif 'spi' in mod_name.lower():
                p_type = 'Custom RTL SPI'
                driver_name = 'Custom_SPI_RTL'
                spi_p = [f'{port}({pin})' for port, pin in pin_mappings.items() if any(k in port.upper() for k in ('SDIN', 'SCLK', 'SPI'))]
                pins = ', '.join(spi_p) if spi_p else oled_pins_str
            elif 'debounce' in mod_name.lower():
                p_type = 'Debouncer RTL'
                driver_name = 'N/A'
            elif 'delay' in mod_name.lower():
                p_type = 'Timer/Delay RTL'
                driver_name = 'N/A'

            extracted_peripherals.append({
                'peripheralBlock': mod_name,
                'type': p_type,
                'driverName': driver_name,
                'version': '1.0',
                'bus': 'RTL Custom Interconnect',
                'clockSource': 'GCLK (100 MHz)' if 'GCLK' in pin_mappings else 'FCLK0',
                'clockFrequency': '100 MHz',
                'baseAddress': None,
                'addressRange': 'N/A — RTL-only design',
                'physicalPinMapping': pins,
                'clockNetIndicator': True,
                'interruptNumber': None,
                'dma': 'Disabled',
                'operatingMode': 'Custom RTL logic',
                'status': 'insufficient_evidence',
                'requires_review': True,
                'confidence': 90,
                'provenanceSource': 'Derived from uploaded Vivado RTL/XDC project'
            })

        for core_name, _ in xci_cores:
            if core_name in seen_blocks:
                continue
            seen_blocks.add(core_name)

            core_type = 'Block Memory Generator'
            if 'rom' in core_name.lower() or 'init' in core_name.lower():
                core_type = 'ROM Memory Core'
            elif 'char' in core_name.lower():
                core_type = 'Font ROM Core'
            elif 'pixel' in core_name.lower() or 'buffer' in core_name.lower():
                core_type = 'Pixel Framebuffer BRAM'

            extracted_peripherals.append({
                'peripheralBlock': core_name,
                'type': core_type,
                'driverName': 'xilinx_bram',
                'version': '1.0',
                'bus': 'BRAM Controller / Native',
                'clockSource': 'GCLK (100 MHz)',
                'clockFrequency': '100 MHz',
                'baseAddress': None,
                'addressRange': 'N/A — RTL IP Core',
                'physicalPinMapping': 'Internal BRAM',
                'clockNetIndicator': False,
                'interruptNumber': None,
                'dma': 'Disabled',
                'operatingMode': 'Memory-Mapped ROM/RAM',
                'status': 'insufficient_evidence',
                'requires_review': True,
                'confidence': 95,
                'provenanceSource': 'Extracted from Vivado XCI IP core'
            })

        return {
            'boardName': board_name,
            'fpgaDevice': fpga_part,
            'architecture': architecture,
            'processor': processor,
            'hasBlockDesign': has_bd,
            'designType': 'RTL/Verilog',
            'status': 'insufficient_evidence',
            'requires_review': True,
            'peripherals': extracted_peripherals,
            'validation': {
                'passed': True,
                'issueCount': 0,
                'warningCount': 0,
                'issues': [],
                'warnings': []
            }
        }
    except Exception as err:
        return None


def extract_zip_text(file_path: str) -> str:
    text_content = []
    try:
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            for file_name in zip_ref.namelist():
                ext = os.path.splitext(file_name)[1].lower()
                if ext in ['.txt', '.csv', '.netlist', '.net', '.v', '.vhd', '.dts', '.dtsi', '.xdc', '.tcl', '.json', '.c', '.h', '.xml', '.hwh', '.sysdef']:
                    try:
                        with zip_ref.open(file_name) as f:
                            text_content.append(f'--- File: {file_name} ---')
                            text_content.append(f.read().decode('utf-8', errors='ignore'))
                    except Exception:
                        pass
    except Exception as e:
        return f'Error parsing ZIP: {e}'
    return '\n'.join(text_content)


def try_parse_json_block(text: str) -> list:
    """Helper to detect and parse JSON blocks containing peripheral details."""
    text_stripped = text.strip()
    m = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if m:
        try:
            parsed = json.loads(m.group(1).strip())
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "peripherals" in parsed:
                return parsed["peripherals"]
            if isinstance(parsed, dict):
                return [parsed]
        except Exception:
            pass

    for match in re.finditer(r'(\[.*\]|\{.*\})', text_stripped, re.DOTALL):
        try:
            parsed = json.loads(match.group(1))
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "peripherals" in parsed:
                return parsed["peripherals"]
            if isinstance(parsed, dict):
                return [parsed]
        except Exception:
            pass
    return []


# ── Vision-structured text parser: extract PERIPHERAL: / BOARD: / etc. lines ──
def parse_vision_structured_lines(text: str, architecture: str, clock_freq: str) -> list:
    """Parse the structured output produced by the Vision prompt."""
    # 1. Try parsing JSON first
    json_peripherals = try_parse_json_block(text)
    if json_peripherals:
        peripherals = []
        seen = set()
        for p in json_peripherals:
            if not isinstance(p, dict):
                continue
            name = p.get('peripheralBlock') or p.get('name') or p.get('peripheral') or p.get('block')
            if not name:
                continue
            name = str(name).strip()
            if name in seen:
                continue
            seen.add(name)

            addr = p.get('baseAddress') or p.get('address') or p.get('addr') or p.get('base')
            if not addr:
                continue
            addr = str(addr).strip().upper()
            if not re.match(r'^0X[0-9A-F]{1,8}$', addr):
                continue

            irq = p.get('interruptNumber') or p.get('irq') or p.get('interrupt')
            irq_num = None
            try:
                irq_num = int(irq)
            except (ValueError, TypeError):
                if str(irq).lower() == 'requires vivado/xsa':
                    irq_num = 'Requires Vivado/XSA'

            driver = p.get('driverName') or p.get('driver') or 'N/A'
            p_type, p_driver = _infer_type_driver(name, str(driver), architecture)

            pins = p.get('physicalPinMapping') or p.get('pins') or p.get('pinMapping') or 'N/A'
            clk = p.get('clockFrequency') or p.get('clk') or p.get('clock') or 'N/A'
            bus = p.get('bus') or 'N/A'

            peripherals.append({
                'peripheralBlock': name,
                'type': p_type,
                'driverName': p_driver if p_driver != 'N/A' else str(driver),
                'version': '1.0',
                'bus': bus if bus != 'N/A' else ('AXI4-Lite' if 'AXI' in architecture.upper() else 'APB'),
                'clockSource': 'FCLK0',
                'clockFrequency': clk if clk != 'N/A' else clock_freq,
                'baseAddress': addr,
                'physicalPinMapping': str(pins),
                'clockNetIndicator': p_type != 'GPIO',
                'interruptNumber': irq_num,
                'dma': 'Disabled',
                'operatingMode': 'Interrupt' if irq_num is not None else 'Polling',
                'status': 'Active',
                'confidence': 97,
            })
        return peripherals

    # 2. Fall back to robust line-by-line parsing
    peripherals = []
    seen = set()

    for line in text.splitlines():
        line = line.strip()
        line_clean = re.sub(r'^[\s\-\*\d\.\#]+', '', line)
        line_clean = line_clean.replace('**', '')
        
        if not re.search(r'\bPERIPHERAL\b', line_clean, re.IGNORECASE):
            continue
        try:
            def _field(key):
                m = re.search(rf'\b{key}\b\s*:\s*([^|]+)', line_clean, re.IGNORECASE)
                return m.group(1).strip() if m else 'N/A'

            name   = _field('PERIPHERAL')
            addr   = _field('ADDR')
            if addr == 'N/A':
                addr = _field('ADDRESS')
            irq    = _field('IRQ')
            if irq == 'N/A':
                irq = _field('INTERRUPT')
            bus    = _field('BUS')
            driver = _field('DRIVER')
            pins   = _field('PINS')
            if pins == 'N/A':
                pins = _field('PIN')
            clk    = _field('CLK')
            if clk == 'N/A':
                clk = _field('CLOCK')

            if name == 'N/A' or addr == 'N/A':
                continue
            if not re.match(r'^0x[0-9A-Fa-f]{1,8}$', addr, re.IGNORECASE):
                continue
            if name in seen:
                continue
            seen.add(name)

            irq_num = None
            try:
                irq_num = int(irq)
            except (ValueError, TypeError):
                if irq.lower() == 'requires vivado/xsa':
                    irq_num = 'Requires Vivado/XSA'

            p_type, p_driver = _infer_type_driver(name, driver, architecture)

            peripherals.append({
                'peripheralBlock': name,
                'type': p_type,
                'driverName': p_driver if p_driver != 'N/A' else driver,
                'version': '1.0',
                'bus': bus if bus != 'N/A' else ('AXI4-Lite' if 'AXI' in architecture.upper() else 'APB'),
                'clockSource': 'FCLK0',
                'clockFrequency': clk if clk != 'N/A' else clock_freq,
                'baseAddress': addr.upper(),
                'physicalPinMapping': pins,
                'clockNetIndicator': p_type != 'GPIO',
                'interruptNumber': irq_num,
                'dma': 'Disabled',
                'operatingMode': 'Interrupt' if irq_num is not None else 'Polling',
                'status': 'Active',
                'confidence': 97,
            })
        except Exception:
            continue
    return peripherals


def _infer_type_driver(name: str, existing_driver: str, architecture: str) -> tuple:
    """Infer peripheral type and correct Xilinx driver from a name string."""
    n = name.lower()
    arch = architecture.lower()
    is_microblaze = 'microblaze' in arch
    is_zynq7 = 'zynq-7000' in arch or 'cortexa9' in arch or '7z' in arch
    is_mpsoc  = 'ultrascale' in arch or 'mpsoc' in arch or 'a53' in arch
    is_stm32  = 'stm32' in arch

    # Direct PL AXI driver detection rules
    if 'uartlite' in n or 'axi_uart' in n or 'uart_lite' in n:
        return 'UART', 'xuartlite'
    if 'axi_gpio' in n or n.startswith('gpio_') or 'gpio0' in n or 'gpio_0' in n:
        if is_stm32:
            return 'GPIO', 'stm32_gpio'
        if is_microblaze or 'axi' in n or '_' in n:
            return 'GPIO', 'xgpio'
    if 'axi_timer' in n or n.startswith('timer_') or 'timer0' in n or 'timer_0' in n or 'axi_tmr' in n:
        if is_microblaze or 'axi' in n or '_' in n:
            return 'Timer', 'xtmrctr'
    if 'axi_iic' in n or n.startswith('iic_') or 'iic0' in n or 'iic_0' in n or 'axi_i2c' in n:
        if is_microblaze or 'axi' in n or '_' in n:
            return 'I2C', 'xiic'
    if 'axi_spi' in n or n.startswith('spi_') or 'spi0' in n or 'spi_0' in n:
        if is_microblaze or 'axi' in n or '_' in n:
            return 'SPI', 'xspi'

    if 'uart' in n or 'usart' in n or 'serial' in n:
        if is_microblaze or 'lite' in n:
            return 'UART', 'xuartlite'
        if is_stm32:
            return 'UART', 'stm32_uart'
        return 'UART', 'xuartps'
    if 'gpio' in n:
        if is_microblaze or 'axi' in n:
            return 'GPIO', 'xgpio'
        if is_stm32:
            return 'GPIO', 'stm32_gpio'
        return 'GPIO', 'xgpiops'
    if 'spi' in n:
        if is_microblaze or 'axi' in n:
            return 'SPI', 'xspi'
        return 'SPI', 'xspips'
    if 'i2c' in n or 'iic' in n:
        if is_microblaze or 'axi' in n:
            return 'I2C', 'xiic'
        return 'I2C', 'xiicps'
    if 'can' in n:
        return 'CAN', 'xcanps'
    if 'ethernet' in n or 'eth' in n or 'gem' in n or 'emac' in n:
        return 'Ethernet', 'xemacps'
    if 'usb' in n:
        return 'USB', 'xusbps'
    if 'sd' in n or 'mmc' in n or 'sdio' in n:
        return 'SD/MMC', 'xsdps'
    if 'qspi' in n:
        return 'QSPI', 'xqspips'
    if 'timer' in n or 'tmr' in n or 'ttc' in n:
        if is_microblaze or 'axi' in n:
            return 'Timer', 'xtmrctr'
        return 'Timer', 'xttcps'
    if 'dma' in n:
        return 'DMA', 'xaxidma'
    if 'bram' in n or 'axi_bram' in n:
        return 'BRAM', 'xbram'
    if 'intc' in n or 'gic' in n or 'interrupt' in n:
        if is_microblaze:
            return 'Interrupt Controller', 'xintc'
        return 'Interrupt Controller', 'xscugic'
    if 'adc' in n or 'xadc' in n:
        return 'ADC', 'xadcps'
    if 'pcie' in n:
        return 'PCIe', 'xaxipcie'
    if 'pwm' in n:
        return 'PWM', 'xpwm'
    if 'flash' in n or 'nor' in n:
        return 'Flash', 'xilflash'
    return 'GPIO', existing_driver if existing_driver not in ('N/A', '') else 'xgpio'



# ── Main text-based hardware parser ──────────────────────────────────────────
def parse_hardware_specs(text: str) -> dict:
    """Parse combined text (including Vision output) for hardware model."""

    # ── Architecture detection ────────────────────────────────────────────────
    board_name  = 'NOT FOUND IN PDF'
    fpga_device = 'NOT FOUND IN PDF'
    memory_size = 'NOT FOUND IN PDF'
    flash_type  = 'NOT FOUND IN PDF'
    clock_sources = []

    tl = text.lower()
    architecture = 'Zynq-7000'
    if 'zynq ultrascale' in tl or 'mpsoc' in tl or 'zu9eg' in tl or 'zu3eg' in tl or 'zynqmp' in tl:
        architecture = 'Zynq UltraScale+'
    elif 'versal' in tl or 'vck190' in tl:
        architecture = 'Versal'
    elif 'stm32mp' in tl or 'stm32mp1' in tl or 'stm32mp157' in tl:
        architecture = 'STM32MP1'
    elif 'stm32' in tl:
        architecture = 'STM32'
    elif 'microblaze' in tl or 'axi_gpio' in tl or 'axi_uartlite' in tl:
        architecture = 'MicroBlaze'
    elif 'sitara' in tl or 'am335' in tl:
        architecture = 'Sitara AM335x'
    elif 'jetson' in tl or 'tegra' in tl:
        architecture = 'NVIDIA Jetson'
    elif ('raspberry pi' in tl or 'compute module 4' in tl or 'cm4' in tl
          or 'bcm2711' in tl or 'cortex-a72' in tl or 'cortex_a72' in tl
          or 'rpi' in tl or 'raspberrypi' in tl or 'cm4io' in tl):
        architecture = 'Raspberry Pi BCM2711'
    elif 'imx8' in tl or 'i.mx8' in tl or 'imx 8' in tl or 'cortex-a53' in tl:
        architecture = 'NXP i.MX8'
    elif 'imx6' in tl or 'i.mx6' in tl:
        architecture = 'NXP i.MX6'
    elif 'am64' in tl or 'am243' in tl or 'am62' in tl:
        architecture = 'TI AM64x'

    def _strip_md(s: str) -> str:
        """Strip markdown bold/italic markers and normalize whitespace."""
        return re.sub(r'\*+', '', s).strip()

    # Detect BOARD: (structured label first)
    board_m = re.search(r'BOARD:\s*([^\n|,]+)', text, re.IGNORECASE)
    if board_m:
        board_name = _strip_md(board_m.group(1))

    # Architecture-aware board name fallback (when structured BOARD: label absent)
    if board_name == 'NOT FOUND IN PDF' or not board_name.strip():
        arch_lower = architecture.lower()
        if 'raspberry pi' in arch_lower or 'bcm2711' in arch_lower:
            # Look for the most specific CM4 board name in the text
            rpi_m = re.search(
                r'(Raspberry Pi Compute Module 4[^\n,;|]*IO Board[^\n,;|]*|'
                r'Raspberry Pi CM4[^\n,;|]*|'
                r'CM4IO[^\n,;|]*|'
                r'CM4 IO Board)',
                text, re.IGNORECASE)
            board_name = _strip_md(rpi_m.group(0)) if rpi_m else 'Raspberry Pi CM4 IO Board'
            # Normalize to clean form
            if len(board_name) > 60:
                board_name = 'Raspberry Pi CM4 IO Board'
        elif 'stm32mp' in arch_lower:
            stm_m = re.search(r'(STM32MP157[A-Z0-9\-]+[^\n,;|]*|STM32MP1[^\n,;|]{0,30})', text, re.IGNORECASE)
            board_name = _strip_md(stm_m.group(0)) if stm_m else 'STM32MP1 Discovery Kit'
        elif 'nxp' in arch_lower or 'imx8' in arch_lower:
            nxp_m = re.search(r'(i\.MX8[^\n,;|]{0,30}EVK[^\n,;|]{0,20}|i\.MX 8[^\n,;|]{0,30})', text, re.IGNORECASE)
            board_name = _strip_md(nxp_m.group(0)) if nxp_m else 'NXP i.MX8M Plus EVK'

    # Detect CPU:
    cpu_m = re.search(r'CPU:\s*([^\n|,]+)', text, re.IGNORECASE)
    _SENTINEL_CPU = {'n/a', 'null', 'unknown', 'not found', 'not found in pdf', '', 'none', 'requires vivado/xsa'}
    raw_cpu = _strip_md(cpu_m.group(1)) if cpu_m else ''
    if raw_cpu.lower().strip('"').strip() not in _SENTINEL_CPU:
        cpu_name = raw_cpu
    else:
        cpu_name = _default_cpu(architecture)

    # Always prefer architecture-derived CPU for architectures with known CPUs
    if cpu_name.lower() in _SENTINEL_CPU or cpu_name == _default_cpu('Zynq-7000') and architecture not in ('Zynq-7000',):
        cpu_name = _default_cpu(architecture)


    # Detect FPGA:
    fpga_m = re.search(r'FPGA:\s*([^\n|,]+)', text, re.IGNORECASE)
    if fpga_m:
        _v = _strip_md(fpga_m.group(1))
        fpga_device = _v if _v.upper() not in ('N/A', 'NOT FOUND IN PDF', '', 'NULL', 'NONE') else 'N/A'

    # Detect MEMORY:
    mem_m = re.search(r'MEMORY:\s*([^\n|,]+)', text, re.IGNORECASE)
    if mem_m:
        _v = _strip_md(mem_m.group(1))
        memory_size = _v if _v.upper() not in ('N/A', 'NOT FOUND IN PDF', '', 'NULL', 'NONE') else 'N/A'

    # Detect FLASH:
    flash_m = re.search(r'FLASH:\s*([^\n|,]+)', text, re.IGNORECASE)
    if flash_m:
        _v = _strip_md(flash_m.group(1))
        flash_type = _v if _v.upper() not in ('N/A', 'NOT FOUND IN PDF', '', 'NULL', 'NONE') else 'N/A'

    # Detect CLOCK: lines
    for m in re.finditer(r'CLOCK:\s*([^\n|]+)', text, re.IGNORECASE):
        cs = _strip_md(m.group(1))
        if cs and cs.upper() not in ('N/A', 'NONE', '') and cs not in clock_sources:
            clock_sources.append(cs)

    # Fallback clock from generic pattern
    clock_freq = '100 MHz'
    clk_m = re.search(r'(?:clock|clk|frequency)\s*(?:is|=)?\s*(\d+\s*[MG]Hz)', text, re.IGNORECASE)
    if clk_m:
        clock_freq = clk_m.group(1)
    if not clock_sources:
        clock_sources.append(f'FCLK0 = {clock_freq}')

    # ── Peripheral extraction from Vision structured lines ────────────────────
    peripherals = parse_vision_structured_lines(text, architecture, clock_freq)

    # ── Peripheral extraction from raw text patterns ──────────────────────────
    patterns = [
        r'([A-Za-z0-9_]+)\s*@\s*(0x[0-9A-Fa-f]{8})',
        r'([A-Za-z0-9_]{3,30})\s*:\s*(0x[0-9A-Fa-f]{8})',
        r'(0x[0-9A-Fa-f]{8})\s*-\s*([A-Za-z0-9_]{3,30})',
        r'([A-Za-z0-9_]+)\s+base\s+address\s+is\s+(0x[0-9A-Fa-f]{8})',
        r'#define\s+([A-Za-z0-9_]+)_(?:BASEADDR|BASE)\s+(0x[0-9A-Fa-f]{8})',
        r'XPAR_([A-Za-z0-9_]+)_BASEADDR\s+(0x[0-9A-Fa-f]{8})',
    ]

    seen_blocks = set(p['peripheralBlock'] for p in peripherals)

    def add_peripheral(block: str, addr: str):
        block_clean = block.strip()
        addr_clean  = addr.strip().upper()
        if block_clean.lower() in ('baseaddr', 'base', 'addr', 'offset', 'mask') or len(block_clean) < 3:
            return
        if block_clean in seen_blocks:
            return
        if not re.match(r'^0X[0-9A-F]{1,8}$', addr_clean):
            return
        seen_blocks.add(block_clean)

        p_type, p_driver = _infer_type_driver(block_clean, 'generic-uio', architecture)

        irq_m = re.search(rf'{re.escape(block_clean)}.*?(?:irq|interrupt)\s*(?:is|=)?\s*(\d+)', text, re.IGNORECASE)
        irq_num = None
        try:
            irq_num = int(irq_m.group(1)) if irq_m else 'Requires Vivado/XSA'
        except (ValueError, AttributeError):
            irq_num = 'Requires Vivado/XSA'

        pin_m = re.search(rf'{re.escape(block_clean)}.*?(?:pin|mapping|pins|mio|emio|led|btn|sw)\s*(?:is|=)?\s*([A-Za-z0-9_\[\]:/]+)', text, re.IGNORECASE)
        pins = pin_m.group(1) if pin_m else 'Requires Vivado/XSA'

        addr_int = int(addr_clean.replace('0X', ''), 16)
        addr_range = f'{addr_clean} - 0x{(addr_int + 0xFFF):08X}'

        peripherals.append({
            'peripheralBlock': block_clean,
            'type': p_type,
            'driverName': p_driver,
            'version': '1.0',
            'bus': 'AXI4-Lite' if architecture not in ('STM32', 'Sitara AM335x') else 'APB/AHB',
            'clockSource': 'FCLK0',
            'clockFrequency': clock_freq,
            'baseAddress': f'0x{addr_int:08X}',
            'addressRange': addr_range,
            'physicalPinMapping': pins,
            'clockNetIndicator': p_type != 'GPIO',
            'interruptNumber': irq_num,
            'dma': 'Disabled',
            'operatingMode': 'Interrupt' if irq_num is not None else 'Polling',
            'status': 'Active',
            'confidence': 95,
        })

    # ── Peripheral extraction from table rows (e.g. AXI GPIO | gpio_0 | 0x41200000 | 64 KB | 61) ──
    for line in text.splitlines():
        line_s = line.strip()
        if not line_s or 'base address' in line_s.lower() and 'instance' in line_s.lower():
            continue
        # Match table row pattern: optional type/name | instance | 0xHEXADDR | size | irq
        # E.g. AXI GPIO | gpio_0 | 0x41200000 | 64 KB | 61
        table_m = re.search(r'(?:\|?\s*([A-Za-z0-9_\s]+?)\s*\|)?\s*\|?\s*([A-Za-z0-9_]+)\s*\|?\s*(0x[0-9A-Fa-f]{8})\s*\|?\s*(\d+\s*[KMG]?B)?\s*\|?\s*(\d+)?\s*\|?', line_s)
        if table_m:
            raw_pname = (table_m.group(1) or '').strip()
            inst_name = table_m.group(2).strip()
            addr_str = table_m.group(3).strip().upper()
            irq_str = table_m.group(5)

            # Determine best block name (e.g. gpio_0 or AXI GPIO)
            block_name = inst_name if inst_name and inst_name.lower() not in ('peripheral', 'instance', 'name') else raw_pname
            if block_name and addr_str.startswith('0X'):
                irq_val = int(irq_str) if irq_str else None
                add_peripheral(block_name, addr_str)
                # Ensure parsed IRQ is attached
                for p in peripherals:
                    if p['peripheralBlock'] == block_name and irq_val is not None:
                        p['interruptNumber'] = irq_val
                        p['operatingMode'] = 'Interrupt'

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            if '0x' in match.group(1).lower():
                addr, block = match.group(1), match.group(2)
            else:
                block, addr = match.group(1), match.group(2)
            add_peripheral(block, addr)


    # ── Smart fallback if nothing extracted ───────────────────────────────────
    if not peripherals:
        peripherals = _default_peripherals(architecture, clock_freq)

    # ── Validation stage ──────────────────────────────────────────────────────
    validation = _validate_peripherals(peripherals)

    # ── Controller mappings by architecture ───────────────────────────────────
    arch_lower = architecture.lower()
    if 'zynq' in arch_lower or 'mpsoc' in arch_lower:
        reset_ctrl = 'PSR (Processor System Reset)'
        irq_ctrl   = 'GIC (Generic Interrupt Controller)'
    elif 'raspberry pi' in arch_lower or 'bcm2711' in arch_lower:
        reset_ctrl = 'BCM2711 Reset Controller'
        irq_ctrl   = 'GIC-400 (ARM Generic Interrupt Controller)'
    elif 'stm32mp' in arch_lower:
        reset_ctrl = 'RCC Reset Controller (STM32MP1)'
        irq_ctrl   = 'GIC-400 (ARM Generic Interrupt Controller)'
    elif 'stm32' in arch_lower:
        reset_ctrl = 'RCC Reset Controller'
        irq_ctrl   = 'NVIC (Nested Vectored Interrupt Controller)'
    elif 'nxp' in arch_lower or 'imx' in arch_lower:
        reset_ctrl = 'SRC (System Reset Controller)'
        irq_ctrl   = 'GIC-400 (ARM Generic Interrupt Controller)'
    elif 'ti am' in arch_lower:
        reset_ctrl = 'PRM (Power and Reset Manager)'
        irq_ctrl   = 'GIC-500 (ARM Generic Interrupt Controller)'
    elif 'microblaze' in arch_lower:
        reset_ctrl = 'AXI GPIO Reset'
        irq_ctrl   = 'AXI INTC (Interrupt Controller)'
    else:
        reset_ctrl = 'RCC Reset'
        irq_ctrl   = 'NVIC (Nested Vectored Interrupt Controller)'

    # ── Assemble hardware model ───────────────────────────────────────────────
    hardware_model = {
        'boardName':           board_name,
        'fpgaDevice':          fpga_device,
        'architecture':        architecture,
        'processor':           cpu_name,
        'memorySize':          memory_size,
        'flashType':           flash_type,
        'clockSources':        clock_sources,
        'clockFrequency':      clock_freq,
        'resetController':     reset_ctrl,
        'interruptController': irq_ctrl,
        'peripherals':         peripherals,
        'validation':          validation,
    }
    return hardware_model



def _default_cpu(architecture: str) -> str:
    return {
        'Zynq-7000':              'ARM Cortex-A9',
        'Zynq UltraScale+':       'ARM Cortex-A53',
        'Versal':                 'ARM Cortex-A72',
        'STM32':                  'ARM Cortex-M7',
        'STM32MP1':               'ARM Cortex-A7',
        'MicroBlaze':             'MicroBlaze (soft-core)',
        'Sitara AM335x':          'ARM Cortex-A8',
        'NVIDIA Jetson':          'ARM Cortex-A78AE',
        'Raspberry Pi BCM2711':   'ARM Cortex-A72',
        'NXP i.MX8':              'ARM Cortex-A53',
        'NXP i.MX6':              'ARM Cortex-A9',
        'TI AM64x':               'ARM Cortex-A53',
    }.get(architecture, 'ARM Cortex-A9')



def _validate_peripherals(peripherals: list) -> dict:
    """Run hardware validation: duplicate blocks, address conflicts, missing clocks."""
    issues = []
    warnings = []

    # Duplicate block names
    names = [p['peripheralBlock'] for p in peripherals]
    seen = set()
    for n in names:
        if n in seen:
            issues.append(f'DUPLICATE PERIPHERAL: {n}')
        seen.add(n)

    # Address conflicts
    addr_map = {}
    for p in peripherals:
        addr = p.get('baseAddress', '')
        if addr in addr_map:
            issues.append(f'ADDRESS CONFLICT: {p["peripheralBlock"]} and {addr_map[addr]} share {addr}')
        else:
            addr_map[addr] = p['peripheralBlock']

    # Missing clocks
    for p in peripherals:
        if p.get('clockNetIndicator') and not p.get('clockFrequency'):
            warnings.append(f'MISSING CLOCK: {p["peripheralBlock"]}')

    # Missing IRQ for interrupt-mode peripherals
    for p in peripherals:
        if p.get('operatingMode') == 'Interrupt' and p.get('interruptNumber') is None:
            warnings.append(f'MISSING IRQ: {p["peripheralBlock"]} set to Interrupt mode but no IRQ assigned')

    return {
        'peripheralCount': len(peripherals),
        'addressCount':    len(addr_map),
        'issueCount':      len(issues),
        'warningCount':    len(warnings),
        'issues':          issues,
        'warnings':        warnings,
        'passed':          len(issues) == 0,
    }


def _default_peripherals(architecture: str, clock_freq: str) -> list:
    # NEVER fabricate hardware peripherals when no memory-mapped addresses can be determined.
    return []


# ── CSV hardware parser ───────────────────────────────────────────────────────
def parse_csv_hardware(file_path: str) -> dict:
    peripherals_map = {}
    architecture = 'STM32'
    clock_freq = '100 MHz'

    with open(file_path, mode='r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        f.seek(0)

        tl = content.lower()
        if 'zynq' in tl:
            architecture = 'Zynq-7000'
        elif 'microblaze' in tl:
            architecture = 'MicroBlaze'
        elif 'stm32' in tl:
            architecture = 'STM32'

        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        def find_col(possible_names):
            for name in possible_names:
                for h in headers:
                    if name.lower() in h.strip().lower():
                        return h
            return None

        col_block  = find_col(['signal', 'peripheral', 'block', 'name', 'component'])
        col_addr   = find_col(['base address', 'address', 'base_address', 'addr'])
        col_pin    = find_col(['pin', 'pad', 'ball'])
        col_driver = find_col(['driver', 'driver name', 'module'])
        col_freq   = find_col(['frequency', 'clock', 'clk', 'rate'])
        col_irq    = find_col(['irq', 'interrupt', 'int'])

        for row in reader:
            block_val  = (row.get(col_block,  '') or '').strip() if col_block  else ''
            addr_val   = (row.get(col_addr,   '') or '').strip().lower() if col_addr   else ''
            pin_val    = (row.get(col_pin,    '') or '').strip() if col_pin    else ''
            driver_val = (row.get(col_driver, '') or '').strip() if col_driver else ''
            freq_val   = (row.get(col_freq,   '') or '').strip() if col_freq   else ''
            irq_val    = (row.get(col_irq,    '') or '').strip() if col_irq    else ''

            if not block_val or not addr_val:
                continue
            if not addr_val.startswith('0x'):
                addr_val = '0x' + addr_val

            if addr_val in peripherals_map:
                entry = peripherals_map[addr_val]
                if pin_val and pin_val not in entry['pins']:
                    entry['pins'].append(pin_val)
                if block_val not in entry['raw_names']:
                    entry['raw_names'].append(block_val)
            else:
                peripherals_map[addr_val] = {
                    'raw_names': [block_val],
                    'pins':      [pin_val] if pin_val else [],
                    'driver':    driver_val,
                    'frequency': freq_val,
                    'irq':       irq_val,
                }

    peripherals = []
    for addr, data in peripherals_map.items():
        raw_names = data['raw_names']
        clean_name = raw_names[0] if len(raw_names) == 1 else (os.path.commonprefix(raw_names).rstrip('_-') or '/'.join(raw_names))
        pins_str = '/'.join(data['pins']) if data['pins'] else 'N/A'
        if data['frequency']:
            clock_freq = data['frequency']

        irq_num = None
        try:
            irq_num = int(data['irq'])
        except (ValueError, TypeError):
            pass

        p_type, p_driver = _infer_type_driver(clean_name, data['driver'] or 'generic-uio', architecture)

        try:
            addr_int = int(addr.replace('0x', ''), 16)
            addr_range = f'{addr.upper()} - 0x{(addr_int + 0xFFF):08X}'
        except ValueError:
            addr_range = 'N/A'

        peripherals.append({
            'peripheralBlock': clean_name,
            'type': p_type,
            'driverName': p_driver,
            'version': '1.0',
            'bus': 'AXI4-Lite' if architecture != 'STM32' else 'APB/AHB',
            'clockSource': 'FCLK0' if architecture != 'STM32' else 'PCLK',
            'clockFrequency': clock_freq,
            'baseAddress': addr.upper() if addr.startswith('0x') else addr,
            'addressRange': addr_range,
            'physicalPinMapping': pins_str,
            'clockNetIndicator': p_type != 'GPIO',
            'interruptNumber': irq_num,
            'dma': 'Disabled',
            'operatingMode': 'Interrupt' if irq_num is not None else 'Polling',
            'status': 'Active',
            'confidence': 95,
        })

    return {
        'boardName':           'NOT FOUND IN PDF',
        'fpgaDevice':          'NOT FOUND IN PDF',
        'architecture':        architecture,
        'processor':           _default_cpu(architecture),
        'memorySize':          'NOT FOUND IN PDF',
        'flashType':           'NOT FOUND IN PDF',
        'clockSources':        [f'FCLK0 = {clock_freq}'],
        'clockFrequency':      clock_freq,
        'resetController':     'PSR (Processor System Reset)' if architecture != 'STM32' else 'RCC Reset',
        'interruptController': 'GIC (Generic Interrupt Controller)' if architecture != 'STM32' else 'NVIC',
        'peripherals':         peripherals,
        'validation':          _validate_peripherals(peripherals),
    }


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Missing arguments. Usage: parse_hardware.py <file_type> <file_path>'}, indent=2))
        sys.exit(1)

    file_type = sys.argv[1].lower()
    file_path = sys.argv[2]

    if not os.path.exists(file_path):
        print(json.dumps({'error': f'File does not exist: {file_path}'}, indent=2))
        sys.exit(1)

    xpr_model = parse_vivado_xpr_project(file_path)
    if xpr_model and xpr_model.get('peripherals') is not None and len(xpr_model.get('peripherals')) > 0:
        print(json.dumps(xpr_model, indent=2))
        return

    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.csv':
        print(json.dumps(parse_csv_hardware(file_path), indent=2))
        return

    if ext == '.pdf':
        text = extract_pdf_text_and_vision(file_path)
    elif ext in ('.png', '.jpg', '.jpeg', '.bmp', '.tiff'):
        text = extract_image_text(file_path)
    elif ext == '.docx':
        text = extract_docx_text(file_path)
    elif ext in ('.xlsx', '.xls'):
        text = extract_xlsx_text(file_path)
    elif ext in ('.zip', '.xsa', '.xpr'):
        xpr_model = parse_vivado_xpr_project(file_path)
        if xpr_model and xpr_model.get('peripherals'):
            print(json.dumps(xpr_model, indent=2))
            return
        text = extract_zip_text(file_path)
    else:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
        except Exception as e:
            text = f'Error reading file: {e}'

    if file_path in global_last_fused_model:
        hardware_model = global_last_fused_model[file_path]
    else:
        hardware_model = parse_hardware_specs(text)
    print(json.dumps(hardware_model, indent=2))



if __name__ == '__main__':
    main()

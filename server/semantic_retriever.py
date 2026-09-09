import os
import re
import json
import glob
from typing import List, Dict, Any, Tuple

# Optional compiled libraries
try:
    import chromadb
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────────────
# 1. TEXT EXTRACTOR & LOCAL OCR
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF using PyMuPDF, falling back to EasyOCR if needed."""
    text_content = []
    if PYMUPDF_AVAILABLE:
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                text_content.append(page.get_text())
            doc.close()
        except Exception as e:
            print(f"[WARN] PyMuPDF extraction failed: {e}")

    extracted_text = "\n".join(text_content).strip()
    
    # Fallback to OCR if PDF contains no selectable text and EasyOCR is available
    if not extracted_text and EASYOCR_AVAILABLE:
        print(f"[INFO] No text found in {os.path.basename(pdf_path)}. Running OCR fallback...")
        try:
            reader = easyocr.Reader(['en'])
            # Extract pages as images and run OCR
            doc = fitz.open(pdf_path)
            for page_num in range(min(5, len(doc))):  # OCR first 5 pages maximum for speed
                page = doc.load_page(page_num)
                pix = page.get_pixmap()
                img_data = pix.tobytes("png")
                results = reader.readtext(img_data)
                page_text = " ".join([res[1] for res in results])
                text_content.append(page_text)
            doc.close()
            extracted_text = "\n".join(text_content).strip()
        except Exception as e:
            print(f"[WARN] EasyOCR fallback failed: {e}")

    return extracted_text

# ─────────────────────────────────────────────────────────────────────────────
# 2. DOCUMENT CLASSIFICATION & TAGGING
# ─────────────────────────────────────────────────────────────────────────────

def classify_and_tag_document(filename: str, content: str) -> Dict[str, str]:
    """Classify the uploaded document type and tag appropriate metadata."""
    fn_lower = filename.toLowerCase() if hasattr(filename, 'toLowerCase') else filename.lower()
    content_lower = content.lower()

    # Default Tags
    doc_type = "Application Note"
    vendor = "Unknown"
    board = "Unknown"
    processor = "Unknown"
    peripheral = "Generic"
    revision = "1.0"

    # 1. Classification
    if "schematic" in fn_lower or "circuit" in fn_lower:
      doc_type = "Board Schematic"
    elif "netlist" in fn_lower or fn_lower.endswith('.net') or fn_lower.endswith('.cir'):
      doc_type = "Netlist"
    elif fn_lower.endswith('.dts') or fn_lower.endswith('.dtsi') or "device tree" in fn_lower:
      doc_type = "Device Tree"
    elif "reference manual" in fn_lower or "trm" in fn_lower or "technical reference" in fn_lower:
      doc_type = "Reference Manual"
    elif "datasheet" in fn_lower or "data sheet" in fn_lower:
      doc_type = "Datasheet"
    elif "programming guide" in fn_lower or "register map" in fn_lower:
      doc_type = "Programming Guide"

    # 2. Vendor Discovery
    if "xilinx" in content_lower or "amd" in content_lower or "ug585" in content_lower or "ug1085" in content_lower:
      vendor = "AMD/Xilinx"
    elif "stm32" in content_lower or "stmicroelectronics" in content_lower:
      vendor = "STMicroelectronics"
    elif "nxp" in content_lower or "imx" in content_lower:
      vendor = "NXP"
    elif "texas instruments" in content_lower or "sitara" in content_lower or "am64x" in content_lower:
      vendor = "Texas Instruments"

    # 3. Processor Discovery
    if "cortex-a9" in content_lower or "cortex a9" in content_lower:
      processor = "Cortex-A9"
    elif "cortex-a53" in content_lower or "cortex a53" in content_lower:
      processor = "Cortex-A53"
    elif "cortex-m7" in content_lower or "cortex m7" in content_lower:
      processor = "Cortex-M7"
    elif "microblaze" in content_lower:
      processor = "MicroBlaze"

    # 4. Board Discovery
    if "zcu104" in content_lower or "zcu104" in fn_lower:
      board = "ZCU104"
    elif "zc702" in content_lower or "zc702" in fn_lower:
      board = "ZC702"
    elif "nucleo" in content_lower or "nucleo" in fn_lower:
      board = "Nucleo-H743"

    # 5. Peripheral Identification
    if "gpio" in content_lower:
      peripheral = "GPIO"
    elif "uart" in content_lower or "usart" in content_lower:
      peripheral = "UART"
    elif "spi" in content_lower:
      peripheral = "SPI"
    elif "i2c" in content_lower or "iic" in content_lower:
      peripheral = "I2C"

    # 6. Revision Matching
    rev_match = re.search(r'(?:rev|revision|ver|version)\s*([0-9\.]+)', content_lower)
    if rev_match:
      revision = rev_match.group(1)

    return {
      "doc_type": doc_type,
      "vendor": vendor,
      "board": board,
      "processor": processor,
      "peripheral": peripheral,
      "revision": revision
    }

# ─────────────────────────────────────────────────────────────────────────────
# 3. DUAL-REPOSITORY VECTOR RETRIEVER
# ─────────────────────────────────────────────────────────────────────────────

def get_local_tf_idf(text: str) -> Dict[str, float]:
    """Build a term-frequency bag-of-words representation for semantic scoring."""
    words = re.findall(r'\b[a-zA-Z0-9_]{3,20}\b', text.lower())
    tf = {}
    for w in words:
        tf[w] = tf.get(w, 0.0) + 1.0
    total = len(words) or 1.0
    for w in tf:
        tf[w] = tf[w] / total
    return tf

def cosine_similarity_tf_idf(tf1: Dict[str, float], tf2: Dict[str, float]) -> float:
    """Compute cosine-like overlap between two word vectors."""
    intersection = set(tf1.keys()) & set(tf2.keys())
    numerator = sum(tf1[w] * tf2[w] for w in intersection)
    sum1 = sum(val ** 2 for val in tf1.values())
    sum2 = sum(val ** 2 for val in tf2.values())
    denominator = (sum1 ** 0.5) * (sum2 ** 0.5)
    return numerator / denominator if denominator else 0.0

class DualRepositoryRetriever:
    """Manages separate databases for Static Vendor Knowledge and Project Knowledge."""
    def __init__(self):
        self.vendor_store = []
        self.project_store = []
        self.client = None
        self.vendor_col = None
        self.project_col = None
        
        if CHROMADB_AVAILABLE:
            try:
                db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'workspace', 'chroma'))
                self.client = chromadb.PersistentClient(path=db_path)
                self.vendor_col = self.client.get_or_create_collection("vendor_knowledge")
                self.project_col = self.client.get_or_create_collection("project_knowledge")
            except Exception as e:
                print(f"[WARN] Failed to initialize ChromaDB Collections: {e}")

    def add_document(self, text: str, metadata: Dict[str, str], is_vendor_kb: bool = True):
        # 1. Fallback storage
        vector = get_local_tf_idf(text)
        item = {'text': text, 'metadata': metadata, 'vector': vector}
        if is_vendor_kb:
            self.vendor_store.append(item)
        else:
            self.project_store.append(item)

        # 2. ChromaDB storage
        col = self.vendor_col if is_vendor_kb else self.project_col
        if col:
            try:
                doc_id = f"id_{len(self.vendor_store) + len(self.project_store)}_{hash(text)}"
                col.add(
                    documents=[text],
                    metadatas=[metadata],
                    ids=[doc_id]
                )
            except Exception as e:
                print(f"[WARN] ChromaDB insert error: {e}")

    def query(self, query_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        # Query both repositories and combine
        results = []
        
        # Helper to search in-memory fallbacks
        def search_fallback(store, repo_label):
            query_vector = get_local_tf_idf(query_text)
            hits = []
            for item in store:
                score = cosine_similarity_tf_idf(query_vector, item['vector'])
                confidence = round(score, 2)
                hits.append({
                    'text': item['text'],
                    'metadata': {**item['metadata'], 'repository': repo_label},
                    'score': confidence,
                    'explanation': f"Retrieved from {repo_label} local engine with confidence {confidence * 100}%"
                })
            return hits

        # Chroma Query helper
        def search_chroma(col, repo_label):
            if not col:
                return []
            try:
                res = col.query(query_texts=[query_text], n_results=top_k)
                hits = []
                if res and 'documents' in res and res['documents']:
                    docs = res['documents'][0]
                    metas = res['metadatas'][0] if 'metadatas' in res else [{}] * len(docs)
                    dists = res['distances'][0] if 'distances' in res and res['distances'] else [0.3] * len(docs)
                    for i in range(len(docs)):
                        # Convert Chroma distance to confidence score (assuming distance)
                        confidence = round(max(0.0, 1.0 - dists[i]), 2)
                        hits.append({
                            'text': docs[i],
                            'metadata': {**metas[i], 'repository': repo_label},
                            'score': confidence,
                            'explanation': f"Retrieved from vector store {repo_label} with confidence {confidence * 100}%"
                        })
                    return hits
            except Exception as e:
                print(f"[WARN] Chroma query error: {e}")
            return []

        # Gather from both stores
        vendor_hits = search_chroma(self.vendor_col, 'vendor_kb') if self.vendor_col else search_fallback(self.vendor_store, 'vendor_kb')
        project_hits = search_chroma(self.project_col, 'project_kb') if self.project_col else search_fallback(self.project_store, 'project_kb')

        # Convert to strict Dual Knowledge Schema format
        formatted_vendor = [
            {
                "content": h['text'],
                "source_type": "vendor",
                "source_document": h['metadata'].get('doc_type', 'Vendor Manual') + " (" + h['metadata'].get('vendor', 'Generic') + ")",
                "relevance_score": float(h['score']),
                "metadata": h['metadata']
            }
            for h in vendor_hits
        ]
        formatted_project = [
            {
                "content": h['text'],
                "source_type": "project",
                "source_document": h['metadata'].get('doc_type', 'Project Artifact') + " (" + h['metadata'].get('board', 'Schematic/XSA') + ")",
                "relevance_score": float(h['score']),
                "metadata": h['metadata']
            }
            for h in project_hits
        ]

        combined = formatted_vendor + formatted_project
        combined.sort(key=lambda x: x['relevance_score'], reverse=True)
        return combined[:top_k]

    def query_split(self, query_text: str, top_k: int = 3) -> Dict[str, List[Dict[str, Any]]]:
        """Query vendor and project repositories separately and return grouped evidence."""
        query_vector = get_local_tf_idf(query_text)
        
        vendor_hits = []
        for item in self.vendor_store:
            score = cosine_similarity_tf_idf(query_vector, item['vector'])
            vendor_hits.append({
                "content": item['text'],
                "source_type": "vendor",
                "source_document": item['metadata'].get('doc_type', 'Vendor Reference Manual'),
                "relevance_score": round(score, 2),
                "metadata": item['metadata']
            })
        vendor_hits.sort(key=lambda x: x['relevance_score'], reverse=True)

        project_hits = []
        for item in self.project_store:
            score = cosine_similarity_tf_idf(query_vector, item['vector'])
            project_hits.append({
                "content": item['text'],
                "source_type": "project",
                "source_document": item['metadata'].get('doc_type', 'Uploaded Project File'),
                "relevance_score": round(score, 2),
                "metadata": item['metadata']
            })
        project_hits.sort(key=lambda x: x['relevance_score'], reverse=True)

        return {
            "vendor_evidence": vendor_hits[:top_k],
            "project_evidence": project_hits[:top_k]
        }

# Global singleton
retriever = DualRepositoryRetriever()

def generate_hardware_retrieval_query(hardware_item: str, field_name: str, context: Dict[str, Any]) -> str:
    """Generate a targeted semantic search query for hardware attributes."""
    proc = context.get("processor", "")
    arch = context.get("architecture", "")
    return f"{proc} {arch} {hardware_item} {field_name} base address register interrupt memory map datasheet".strip()

def get_rag_grounded_context(hardware_context: Dict[str, Any], top_k: int = 4) -> Dict[str, Any]:
    """
    RAG Pipeline Grounding:
    Hardware Context -> Generate Query -> Dual Retrieval -> Top-K Evidence -> Grounded LLM Context
    """
    proc = hardware_context.get("processor", "Unknown Processor")
    peripherals = hardware_context.get("peripherals", [])
    
    all_evidence = []
    
    for p in peripherals:
        p_name = p.get("peripheralBlock") or p.get("name") or "Peripheral"
        # Search for missing fields or baseAddress validation
        query_str = generate_hardware_retrieval_query(p_name, "baseAddress interrupt", hardware_context)
        hits = retriever.query(query_str, top_k=top_k)
        for h in hits:
            h["target_peripheral"] = p_name
            all_evidence.append(h)
            
    # Deduplicate and sort evidence
    seen = set()
    unique_evidence = []
    for ev in all_evidence:
        key = (ev["source_type"], ev["source_document"], ev["content"][:40])
        if key not in seen:
            seen.add(key)
            unique_evidence.append(ev)

    unique_evidence.sort(key=lambda x: x["relevance_score"], reverse=True)
    top_evidence = unique_evidence[:top_k]

    # Build grounded LLM prompt text
    grounded_prompt = build_grounded_prompt(hardware_context, top_evidence)

    return {
        "hardware_context": hardware_context,
        "evidence": top_evidence,
        "grounded_prompt": grounded_prompt
    }

def resolve_metadata_evidence(hardware_context: Dict[str, Any], top_k: int = 6) -> Dict[str, Any]:
    """
    Metadata RAG Evidence Resolver:
    Executes targeted semantic searches across Vendor KB and Project KB
    to extract evidence-backed platform specifications (CPU core, arch, core count,
    interconnect, clock frequency, FPGA capability).
    """
    proc = hardware_context.get("processor") or hardware_context.get("name") or "Generic Processor"
    arch = hardware_context.get("architecture", "")
    vendor = hardware_context.get("vendor", "")

    query_str = f"{proc} {vendor} {arch} CPU core architecture core count interconnect FPGA frequency datasheet TRM specification".strip()
    hits = retriever.query(query_str, top_k=top_k)

    # Filter out empty/irrelevant hits with low relevance score
    valid_hits = [h for h in hits if h.get("relevance_score", 0) > 0.15]

    return {
        "processor": proc,
        "query": query_str,
        "evidence_found": len(valid_hits) > 0,
        "evidence_count": len(valid_hits),
        "evidence": valid_hits
    }

def build_grounded_prompt(hardware_context: Dict[str, Any], evidence_list: List[Dict[str, Any]]) -> str:
    """Construct prompt with strict LLM instructions and retrieved evidence grounding."""
    proc = hardware_context.get("processor", "Generic Target")
    arch = hardware_context.get("architecture", "ARM")
    
    project_ev = [e for e in evidence_list if e.get("source_type") == "project"]
    vendor_ev = [e for e in evidence_list if e.get("source_type") == "vendor"]

    prompt_lines = [
        "HARDWARE REASONING CONTEXT:",
        f"Processor Architecture: {proc} ({arch})",
        "Peripherals under analysis:",
        json.dumps(hardware_context.get("peripherals", []), indent=2),
        "",
        "RETRIEVED EVIDENCE GROUNDING:",
    ]
    
    prompt_lines.append("[PROJECT KNOWLEDGE EVIDENCE]")
    if project_ev:
        for ev in project_ev:
            prompt_lines.append(f"Source: {ev['source_document']} (Score: {ev['relevance_score']})")
            prompt_lines.append(f"Evidence: {ev['content'].strip()}")
    else:
        prompt_lines.append("No uploaded project schematic/XSA evidence found.")

    prompt_lines.append("")
    prompt_lines.append("[VENDOR KNOWLEDGE EVIDENCE]")
    if vendor_ev:
        for ev in vendor_ev:
            prompt_lines.append(f"Source: {ev['source_document']} (Score: {ev['relevance_score']})")
            prompt_lines.append(f"Evidence: {ev['content'].strip()}")
    else:
        prompt_lines.append("No matching vendor TRM/datasheet evidence found.")

    prompt_lines.extend([
        "",
        "REASONING INSTRUCTIONS:",
        "1. Use retrieved evidence as the primary single source of truth.",
        "2. Do NOT invent or hallucinate hardware base addresses, IRQs, or register maps.",
        "3. IF evidence exists and is verified: set reasoning_status='supported', confidence_level='HIGH', requires_review=false.",
        "4. IF evidence is missing (Vendor=NONE and Project=NONE): set reasoning_status='insufficient_evidence', baseAddress=null, confidence=0.0, confidence_level='REQUIRES_REVIEW', requires_review=true.",
        "5. IF evidence conflicts between Project and Vendor: set reasoning_status='conflicting_evidence', confidence_level='REQUIRES_REVIEW', requires_review=true.",
        "6. IF a hardware value already exists in deterministic HKL/DTS/XSA: PRESERVE that exact value and do NOT overwrite it.",
        "7. Return ONLY structured JSON output matching the target schema."
    ])

    return "\n".join(prompt_lines)



def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def index_knowledge_base():
    """Index files in knowledge repositories (static vendor manuals vs user project schematics)."""
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'workspace'))
    
    # 1. Index Vendor KB (static manuals)
    vendor_kb_dir = os.path.join(workspace_dir, 'knowledge_base')
    os.makedirs(vendor_kb_dir, exist_ok=True)
    for filepath in glob.glob(os.path.join(vendor_kb_dir, "*")):
        ext = os.path.splitext(filepath)[1].lower()
        if ext in ('.txt', '.dts', '.csv', '.json', '.svd', '.pdf'):
            try:
                filename = os.path.basename(filepath)
                if ext == '.pdf':
                    content = extract_text_from_pdf(filepath)
                else:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                tags = classify_and_tag_document(filename, content)
                chunks = chunk_text(content)
                for chunk in chunks:
                    retriever.add_document(chunk, tags, is_vendor_kb=True)
            except Exception as e:
                print(f"[WARN] Failed indexing vendor document {filepath}: {e}")

    # 2. Index Project KB (uploaded schematics/netlists)
    project_kb_dir = os.path.join(workspace_dir, 'project_base')
    os.makedirs(project_kb_dir, exist_ok=True)
    for filepath in glob.glob(os.path.join(project_kb_dir, "*")):
        ext = os.path.splitext(filepath)[1].lower()
        if ext in ('.txt', '.pdf', '.json', '.dts', '.net'):
            try:
                filename = os.path.basename(filepath)
                if ext == '.pdf':
                    content = extract_text_from_pdf(filepath)
                else:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                tags = classify_and_tag_document(filename, content)
                chunks = chunk_text(content)
                for chunk in chunks:
                    retriever.add_document(chunk, tags, is_vendor_kb=False)
            except Exception as e:
                print(f"[WARN] Failed indexing project document {filepath}: {e}")

def ingest_vendor_document(file_path: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Ingest downloaded official vendor document into semantic retriever with metadata."""
    if not os.path.exists(file_path):
        return {"success": False, "error": f"File not found: {file_path}"}

    try:
        filename = os.path.basename(file_path)
        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.pdf':
            content = extract_text_from_pdf(file_path)
        else:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

        if not content.strip():
            content = f"Official Vendor Document: {metadata.get('document_title', filename)} ({metadata.get('vendor', 'Unknown')} {metadata.get('product', '')})"

        tags = {
            "source_type": "VENDOR_DOCUMENT",
            "vendor": metadata.get("vendor", "Unknown"),
            "board": metadata.get("product", "Unknown"),
            "processor": metadata.get("product", "Unknown"),
            "doc_type": metadata.get("document_type", "TRM"),
            "authority": metadata.get("authority", "OFFICIAL_VENDOR"),
            "source_url": metadata.get("source_url", ""),
            "sha256": metadata.get("sha256", ""),
            "revision": metadata.get("revision", "1.0")
        }

        chunks = chunk_text(content)
        for chunk in chunks:
            retriever.add_document(chunk, tags, is_vendor_kb=True)

        return {"success": True, "chunksCount": len(chunks)}
    except Exception as e:
        return {"success": False, "error": str(e)}

try:
    index_knowledge_base()
except Exception:
    pass


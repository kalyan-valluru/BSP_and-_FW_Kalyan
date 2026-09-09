"""Initialize the persistent ChromaDB vendor collection for the project."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "workspace" / "chroma"
DB.mkdir(parents=True, exist_ok=True)

try:
    import chromadb
except ImportError as exc:
    raise SystemExit("Install requirements.txt first: chromadb is required for the RAG store") from exc

client = chromadb.PersistentClient(path=str(DB))
collection = client.get_or_create_collection("vendor_knowledge")
print(json.dumps({"collection": collection.name, "path": str(DB), "count": collection.count()}, indent=2))

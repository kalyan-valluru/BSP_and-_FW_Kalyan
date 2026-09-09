# ChromaDB RAG Architecture

`backend/server/semantic_retriever.py` already supports a persistent ChromaDB vendor collection at:

`workspace/chroma/`

The official-document ingestion path is:

Official vendor URL -> verified PDF -> SHA-256 manifest -> PDF text extraction -> chunks + provenance -> ChromaDB `vendor_knowledge`.

The backend also maintains deterministic metadata in `workspace/vendor_knowledge/manifest.json` so addresses/registers can be traced to document, revision and URL.

If ChromaDB is unavailable, the service must not invent hardware facts; it may use only explicitly seeded deterministic facts or require installation of the RAG dependencies.

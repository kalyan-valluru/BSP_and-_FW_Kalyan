# Official Vendor Knowledge Base Architecture

Production knowledge-base architecture for acquiring, validating, chunking, and indexing official hardware documentation for bare-metal and Linux BSP/Firmware generation.

## Directory Responsibilities & Architecture

```
bsp_work/
├── knowledge_base/
│   ├── README.md                          # Architecture & usage guide
│   ├── official/                          # Authoritative vendor catalog definitions
│   │   └── official_catalog.json          # Official vendor source URL mapping
│   ├── downloader/                        # Acquisition engine
│   │   └── download_official_docs.mjs     # Downloads, verifies %PDF signature, content-type, SHA-256
│   ├── ingestion/                         # Extraction & indexing pipeline
│   └── manifests/                         # Inventory metadata
│       └── document_manifest.json         # Authoritative inventory of local documents
│
├── workspace/
│   └── vendor_knowledge/
│       ├── STMicroelectronics/            # Local PDF repository structured by vendor/board/type
│       │   └── STM32F4DISCOVERY/
│       │       ├── datasheet/             # stm32f405rg.pdf
│       │       ├── reference_manual/      # rm0090.pdf
│       │       ├── board_manual/          # stm32f4discovery.pdf
│       │       └── schematic/             # mb997-f407vgt6-e01_schematic.pdf
│       └── chroma/                        # Persistent ChromaDB vector RAG store
```

## Approved Official Vendor Sources

Hardware facts are sourced strictly from approved vendor domains:
- **STMicroelectronics**: `st.com`
- **AMD / Xilinx**: `amd.com`, `xilinx.com`
- **NXP**: `nxp.com`
- **Texas Instruments**: `ti.com`
- **NVIDIA**: `nvidia.com`
- **Raspberry Pi**: `raspberrypi.com`

Random blogs, GitHub repositories, or AI-generated synthetic PDFs are strictly prohibited.

## Standard Example Board Packages

The system maintains required document packages for all example targets:
1. **STM32F4DISCOVERY** (Datasheet, Reference Manual, Board Manual, Schematic)
2. **Zynq-7000 / ZedBoard** (Reference Manual, Datasheet)
3. **TI Sitara AM335x / AM64x** (TRM, Datasheet)
4. **NXP i.MX 8M Plus** (Reference Manual, Board Hardware User Guide)
5. **NVIDIA Jetson Orin NX** (Hardware Adaptation & Bring-Up Guide)
6. **Raspberry Pi CM4** (Datasheet)
7. **STM32MP157** (Reference Manual, Datasheet, Discovery Kit User Manual)

## Document Validation & Integrity Rules

Every downloaded file is validated against the following criteria:
1. HTTP 200 Success status.
2. Verified final URL remains on an official vendor domain.
3. First 4 bytes match the `%PDF` signature (`%PDF-`).
4. Rejection of HTML login/redirect pages.
5. SHA-256 hash calculation and byte length logging.

## Unknown Board Flow

When a user selects an unknown board:
1. Identify the vendor and exact SoC.
2. Query official vendor portals for required document packages.
3. Validate downloaded PDFs against official domains and `%PDF` signatures.
4. Save PDFs under `workspace/vendor_knowledge/<Vendor>/<Board>/<document_type>/`.
5. Update `knowledge_base/manifests/document_manifest.json`.
6. Index chunks into ChromaDB with `document_type` metadata.
7. If schematic or reference documentation is unavailable, explicitly return:
   `"Official board schematic not available in the current knowledge base."`

## How to Run on Windows

To download and verify official documentation packages on Windows, double-click:

`DOWNLOAD_DEMO_DOCS.cmd`

Or execute via command prompt:

```cmd
node knowledge_base\downloader\download_official_docs.mjs
node validation\verify_knowledge_base.mjs
```


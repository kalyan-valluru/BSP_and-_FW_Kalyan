# Official Vendor Hardware Knowledge Base

This repository is the authoritative-document cache for the GenAI BSP/FW pipeline.

## Policy
- Only documents downloaded from an allow-listed official vendor domain are authoritative.
- Search-engine results are discovery aids only; the final URL is re-checked before download.
- No synthetic/placeholder datasheet content is created when a download fails.
- Each downloaded document is SHA-256 hashed and recorded in `manifest.json`.
- Parsed chunks are sent to the ChromaDB `vendor_knowledge` collection when ChromaDB is installed.
- Unknown boards are acquired on demand through `POST /api/knowledge/ensure-board`.

## Initial board
- STMicroelectronics STM32F4DISCOVERY / STM32F407VGT6

## On-demand acquisition
Example request:
```json
POST /api/knowledge/ensure-board
{
  "board": "STM32F4DISCOVERY",
  "device": "STM32F407VGT6",
  "vendor": "STMicroelectronics",
  "flow": "bare-metal",
  "peripherals": ["GPIO", "USART"]
}
```

The service downloads only the minimum relevant official documents and caches them for later runs.

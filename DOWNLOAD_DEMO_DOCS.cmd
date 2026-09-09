@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo BSP Astra - Download & Verify Official Documentation
echo ============================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not on PATH.
  pause
  exit /b 1
)

echo [1/2] Running Downloader for Official Vendor Packages...
node knowledge_base\downloader\download_official_docs.mjs

echo.
echo [2/2] Running Knowledge Base Verification...
node validation\verify_knowledge_base.mjs

if errorlevel 1 (
  echo.
  echo [ERROR] Verification failed! One or more required documents are missing or invalid.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] Official Knowledge Base verification completed successfully!
pause

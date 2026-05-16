@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

set "SD_WEBUI_DIR=D:\Github\AI_IMAGE\stable-diffusion-webui"
set "SD_PYTHON=C:\Users\artzy\AppData\Local\Programs\Python\Python310\python.exe"
set "SD_PORT=7861"
set "SD_API_URL=http://127.0.0.1:%SD_PORT%"
set "SD_EXTRA_ARGS=--medvram"

if "%SD_LOWVRAM%"=="1" set "SD_EXTRA_ARGS=--medvram --lowvram"

echo  Modly + SDXL WebUI Launcher
echo  (SDXL txt2img / SDXL img2img nodes — close SD 1.5 WebUI first)
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

if not exist "%SD_WEBUI_DIR%\webui.bat" (
    echo [ERROR] Stable Diffusion WebUI not found at %SD_WEBUI_DIR%
    pause
    exit /b 1
)

echo [1/3] Starting SDXL WebUI (API) on port %SD_PORT%...
if exist "%SD_PYTHON%" (
    start "SDXL WebUI API" /D "%SD_WEBUI_DIR%" cmd /k "set PYTHON=%SD_PYTHON% && set COMMANDLINE_ARGS=--xformers %SD_EXTRA_ARGS% --api --nowebui --port %SD_PORT% && call webui.bat"
) else (
    echo [WARN] SD_PYTHON not found — using default venv Python.
    start "SDXL WebUI API" /D "%SD_WEBUI_DIR%" cmd /k "set COMMANDLINE_ARGS=--xformers %SD_EXTRA_ARGS% --api --nowebui --port %SD_PORT% && call webui.bat"
)

echo [2/3] Waiting for SDXL WebUI API (ports 7861-7866)...
set /a SD_TRIES=0
:wait_sd
for %%P in (7861 7862 7863 7864 7865 7866) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%%P/sdapi/v1/samplers' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "SD_PORT=%%P"
        set "SD_API_URL=http://127.0.0.1:%%P"
        goto sd_found_port
    )
)
set /a SD_TRIES+=1
if !SD_TRIES! GEQ 120 (
    echo [WARN] SDXL WebUI API did not respond in time.
    goto modly_setup
)
timeout /t 5 /nobreak >nul
goto wait_sd

:sd_found_port
echo        SDXL WebUI API is ready at !SD_API_URL!
powershell -NoProfile -Command "$models = (Invoke-RestMethod -Uri '%SD_API_URL%/sdapi/v1/sd-models' -TimeoutSec 10) | ForEach-Object { $_.title }; $xl = @($models | Where-Object { $_ -match 'xl|XL|sd_xl' }); if ($xl.Count -eq 0) { Write-Host '[WARN] No SDXL checkpoint name matched in sd-models. Install SDXL under models/Stable-diffusion/'; exit 0 }; Write-Host 'SDXL checkpoints:'; $xl | Select-Object -First 3 | ForEach-Object { Write-Host ('  - ' + $_) }" 2>nul
echo.

:modly_setup
if not exist "node_modules\" (
    echo Installing Modly dependencies...
    call npm install
    if errorlevel 1 ( pause & exit /b 1 )
)

if not exist "out\" (
    echo Building Modly...
    call npm run build
    if errorlevel 1 ( pause & exit /b 1 )
)

echo [3/3] Launching Modly...
echo        SDXL WebUI: !SD_API_URL!  (SDXL txt2img / SDXL img2img nodes)
echo        Settings - Integrations: set SDXL WebUI Base URL to !SD_API_URL!
echo        Close SDXL WebUI before 3D model steps on 12GB VRAM.
echo.
call npm run preview

endlocal

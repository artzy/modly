@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

set "SD_WEBUI_DIR=D:\Github\AI_IMAGE\stable-diffusion-webui"
set "SD_PORT=7860"
set "SD_API_URL=http://127.0.0.1:%SD_PORT%"

echo  Modly + Stable Diffusion WebUI Launcher
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org
    pause
    exit /b 1
)

:: Check SD WebUI install path
if not exist "%SD_WEBUI_DIR%\webui.bat" (
    echo [ERROR] Stable Diffusion WebUI not found.
    echo         Expected: %SD_WEBUI_DIR%
    echo         Edit SD_WEBUI_DIR in launch_with_sd.bat if installed elsewhere.
    pause
    exit /b 1
)

:: Start SD WebUI with API on SD_PORT (explicit --port avoids silent fallback to 7861)
echo [1/3] Starting Stable Diffusion WebUI (API) on port %SD_PORT%...
start "SD WebUI API" /D "%SD_WEBUI_DIR%" cmd /k "set COMMANDLINE_ARGS=--xformers --api --nowebui --port %SD_PORT% && call webui.bat"

:: Wait until /sdapi/v1/samplers responds on 7860-7865 (up to ~10 min)
echo [2/3] Waiting for SD WebUI API (ports 7860-7865)...
set /a SD_TRIES=0
:wait_sd
for %%P in (7860 7861 7862 7863 7864 7865) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%%P/sdapi/v1/samplers' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "SD_PORT=%%P"
        set "SD_API_URL=http://127.0.0.1:%%P"
        goto sd_found_port
    )
)
set /a SD_TRIES+=1
if !SD_TRIES! GEQ 120 (
    echo [WARN] SD WebUI API did not respond in time.
    echo        Modly will start anyway. Set SD URL in Settings - Integrations.
    echo        Close SD WebUI before the 3D step if you have 12GB VRAM.
    goto modly_setup
)
timeout /t 5 /nobreak >nul
goto wait_sd

:sd_found_port
echo        SD WebUI API is ready at !SD_API_URL!
if not "!SD_PORT!"=="7860" (
    echo [NOTE] SD is not on default port 7860. In Modly: Settings - Integrations
    echo        set SD WebUI Base URL to !SD_API_URL!
)
echo.

:modly_setup
:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo Installing Modly dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

:: Build if out/ is missing
if not exist "out\" (
    echo Building Modly...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
    echo.
)

:: Launch Modly
echo [3/3] Launching Modly...
echo        SD WebUI: !SD_API_URL!  (keep that window open during image generation)
if not "!SD_PORT!"=="7860" echo        Set the same URL in Settings - Integrations.
echo        Tip: close SD WebUI before 3D model steps on 12GB VRAM.
echo.
call npm run preview

endlocal

# Stable Diffusion WebUI API (Modly 연동)

Modly 워크플로는 [Automatic1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) HTTP API를 사용합니다. **SD 1.5**와 **SDXL**은 **별도 WebUI 프로세스**로 기동합니다 (12 GB VRAM에서 동시 로드 비권장).

## 런처·노드·포트 매트릭스

| 용도 | 런처 | 기본 포트 | 워크플로 노드 | Modly Settings |
|------|------|-----------|---------------|----------------|
| SD 1.5 | `launch_with_sd.bat` | 7860 | SD txt2img, SD img2img | SD 1.5 WebUI Base URL |
| SDXL | `launch_with_sd_sdxl.bat` | 7861 | SDXL txt2img, SDXL img2img | SDXL WebUI Base URL |

**동시에 두 런처를 실행하지 마세요.** SDXL 작업 전 SD 1.5 WebUI 창을 종료하세요.

## 사전 조건

1. WebUI 경로 예: `D:\Github\AI_IMAGE\stable-diffusion-webui`
2. SDXL 체크포인트: `models/Stable-diffusion/` (예: `sd_xl_base_1.0.safetensors`)
3. `launch_with_sd_sdxl.bat` 상단 `SD_PYTHON` — Python 3.10 경로 ([`webui-user-sdxl.bat`](d:\Github\AI_IMAGE\stable-diffusion-webui\webui-user-sdxl.bat) 참고)

## API 검증

**SD 1.5 (7860):**

```powershell
$base = "http://127.0.0.1:7860"
$body = @{ prompt = "a red cube"; steps = 4; width = 512; height = 512 } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/sdapi/v1/txt2img" -Method Post -Body $body -ContentType "application/json"
```

**SDXL (7861):**

```powershell
$base = "http://127.0.0.1:7861"
$body = @{ prompt = "a red cube"; steps = 4; width = 1024; height = 1024 } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/sdapi/v1/txt2img" -Method Post -Body $body -ContentType "application/json"
```

체크포인트 이름 확인: `GET http://127.0.0.1:7861/sdapi/v1/sd-models`

## VRAM 12GB 권장 순서

1. 이미지 생성 (SD **또는** SDXL 노드 — 해당 런처만 실행)
2. **WebUI 종료** (VRAM 확보)
3. Modly 3D model 노드 실행

SDXL 1024는 부담이 큽니다. 필요 시 노드에서 768×768, refiner는 비워 두세요.

## 엔드포인트

| 노드 | API |
|------|-----|
| SD / SDXL txt2img | `POST /sdapi/v1/txt2img` |
| SD / SDXL img2img | `POST /sdapi/v1/img2img` |

SDXL 노드에서 **Checkpoint** param은 `override_settings.sd_model_checkpoint` 로 전달됩니다.

# Stable Diffusion WebUI API (Modly 연동)

Modly 워크플로의 **Stable Diffusion WebUI** 노드는 [Automatic1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) HTTP API를 사용합니다.

## 사전 조건

1. WebUI 설치 경로 예: `D:\Github\AI_IMAGE\stable-diffusion-webui`
2. API 활성화로 기동 (포트 예: 7860):

```bat
webui-user.bat
```

`COMMANDLINE_ARGS`에 `--api` 포함. 예:

```
set COMMANDLINE_ARGS=--api --port 7860
```

3. Modly **Settings → Integrations** 에서 **SD WebUI Base URL** 설정 (비우면 `http://127.0.0.1:7860`).  
   SD 콘솔에 `Uvicorn running on ...:7861` 처럼 **7861** 등 다른 포트가 보이면 URL 포트를 맞출 것 (`7860`이 이미 사용 중이면 WebUI가 자동으로 다음 포트를 씀).

## API 검증 (Phase 0)

PowerShell:

```powershell
$base = "http://127.0.0.1:7860"
$body = @{
  prompt = "a red cube, product photo, white background"
  steps = 4
  width = 512
  height = 512
} | ConvertTo-Json

Invoke-RestMethod -Uri "$base/sdapi/v1/txt2img" -Method Post -Body $body -ContentType "application/json"
```

응답 JSON의 `images[0]` 가 base64 PNG이면 정상입니다.

## VRAM 12GB

SD WebUI와 Modly **3D 모델 추론을 동시에 GPU에 올리지 마세요**. 워크플로 권장 순서:

1. txt2img / img2img 노드 실행
2. (선택) 노드에서 **Unload checkpoint after = Yes** 또는 WebUI 종료
3. 3D model 확장 노드 실행

## 엔드포인트 (노드에서 사용)

| 노드 | API |
|------|-----|
| Text to Image | `POST /sdapi/v1/txt2img` |
| Image to Image | `POST /sdapi/v1/img2img` |
| VRAM 해제 (옵션) | `POST /sdapi/v1/unload-checkpoint` |

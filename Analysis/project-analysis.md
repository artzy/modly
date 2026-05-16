# Modly 프로젝트 분석

**분석 일자:** 2026-05-10  
**저장소 버전:** package.json 기준 `0.3.5`

---

## 한 줄 요약

**Modly**는 이미지를 로컬 GPU에서 오픈소스 AI 모델로 3D 메시로 바꾸는 **데스크톱 앱**입니다. UI는 **Electron + React**, 추론·메시 처리는 **Python FastAPI** 백엔드가 담당하며, GitHub 기반 **확장(Extension)** 으로 여러 생성 모델을 물려 쓸 수 있습니다.

---

## 제품 목표와 플랫폼

- **목표:** 클라우드 없이 로컬에서 이미지→3D 생성 (MIT 라이선스, Lightning Pixel / Modly 크레딧 요구사항 README 참고).
- **플랫폼:** Windows·Linux 패키징·CI 명시, README에는 macOS 준비 중 언급.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 데스크톱 셸 | Electron 33, electron-vite 2, TypeScript |
| UI | React 18, Tailwind CSS, Zustand |
| 3D 뷰어·워크플로 시각화 | Three.js, @react-three/fiber / drei, postprocessing, React Flow (@xyflow/react) |
| 백엔드 | FastAPI, Uvicorn (호스트 `127.0.0.1`, 포트 **8765**) |
| 메시 | trimesh, PyMeshLab |
| 모델 배포 | Hugging Face Hub (`huggingface_hub`) |
| 빌드·배포 | electron-builder (Windows NSIS, Linux AppImage, macOS dmg 설정), electron-updater(GitHub Releases) |

네이티브 보조 모듈로 **UV 언랩**(C++), **텍스처 베이킹**(CUDA / Metal 등) 서브패키지가 `api/` 아래에 존재합니다.

---

## 디렉터리 구조 (개념)

- **`electron/`** — 메인 프로세스(`index.ts`), IPC, Python 프로세스 기동(`python-bridge.ts`), 설정·업데이터·내장 확장 동기화 등.
- **`src/`** — 렌더러: `areas/`(Generate, Workflows, Models, Settings, Setup), `shared/`(라우트, 스토어, UI 컴포넌트).
- **`api/`** — FastAPI 앱(`main.py`), 라우터(`routers/`), 생성기 레지스트리·확장 로더(`services/`), `uv_unwrapper`, `texture_baker` 등.
- **`scripts/`** — 내장 확장 빌드, Python embed 다운로드 등.
- **`.github/workflows/`** — PR 시 Windows/Linux 패키지 빌드 CI.

---

## 런타임 아키텍처

1. Electron이 시작되면 **내장 확장 동기화** 후 **`PythonBridge`** 가 `uvicorn main:app` 으로 FastAPI를 같은 머신에서 띄웁니다.
2. 환경 변수로 **`MODELS_DIR`**, **`WORKSPACE_DIR`**, **`EXTENSIONS_DIR`**, HF 토큰 등을 넘깁니다.
3. 프론트는 **`API_BASE_URL`**(로컬 8765)로 REST 호출; 생성 결과 등은 `/workspace/...` 로 파일 서빙됩니다.
4. 앱 수준: 최초 실행 시 **`FirstRunSetup`**, 준비되면 **`MainLayout`** 과 네비게이션(Generate / Workflows / Models / Settings).

---

## 확장(Extension) 시스템

- 확장 디렉터리 스캔: **`manifest.json`** + **`generator.py`** 필수.
- **직접 로드:** 확장 전용 venv가 없으면 `generator.py`를 동적 import.
- **서브프로세스 모드:** 확장에 venv가 있거나 `build_vendor.py`는 있는데 `vendor/` 미구축이면 **`ExtensionProcess`** 로 격리 실행해 의존성·빌드 오류를 UI에서 처리(Repair 등)할 수 있게 합니다.
- 공식 확장 목록은 루트 README 표에 Hunyuan3D Mini 계열, TripoSG, Trellis2 GGUF 등으로 정리되어 있습니다.

---

## 주요 API 라우터 (FastAPI)

`main.py` 기준 등록 라우터:

- `status`, `settings`
- `model` (`/model`)
- `generation` (`/generate`)
- `optimize` (`/optimize`)
- `extensions` (`/extensions`)
- `export` (`/export`)
- `workflow_runs` (`/workflow-runs`)

README 보조 문서에는 TripoSR 기본 모델 예시가 남아 있으나, 실제 제품은 **확장 기반 다중 모델** 구조로 진화한 형태입니다.

---

## 프론트엔드 기능 영역

| 페이지 | 역할 |
|--------|------|
| **Generate** | 이미지 업로드·옵션·3D 뷰어(`Viewer3D`), 생성 HUD/패널 |
| **Workflows** | 노드 그래프(입력, 텍스트/이미지, 확장 노드, 미리보기, 메시 내보내기/최적화 등) |
| **Models** | 확장 설치(GitHub URL), 모델 다운로드 카드 |
| **Settings** | 통합, 저장소, 로그, About 등 |

---

## 빌드·패키징

- `npm run dev`: 내장 확장 빌드 스크립트 후 `electron-vite dev`.
- `npm run package`: 빌드 → Python embed 준비 → electron-builder.
- **`extraResources`**: `api/` 전체(일반적으로 `.venv` 제외), `builtin-extensions`, 플랫폼별 `resources/python-embed`.

---

## CI

- PR 대상 `main`: **Windows**·**Linux**에서 `electron-vite build` + `electron-builder` (코드 서명 자동 탐지 비활성화 옵션으로 Windows).

---

## 참고 사항

- README 실행 예시는 `launcher.bat` / `./launcher.sh` 인데, 저장소에는 **`launch.bat`**, **`launch.sh`** 로 보입니다. 문서와 스크립트 이름을 맞출지 검토하면 좋습니다.
- Electron 메인 윈도우: 프레임리스, `preload` + context isolation, 개발 시 DevTools 자동 오픈.

---

## 결론

Modly는 **Electron이 로컬 FastAPI를 관리**하고, **React·Three.js·React Flow**로 생성과 워크플로 UI를 제공하며, **동적 확장 로딩**으로 여러 이미지→3D 모델을 같은 앱에서 쓰도록 설계된 **풀스택 로컬 3D 생성 도구**입니다.

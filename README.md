# Frame Compare – 피그마 검증 툴

> repo: plugin-01-compare (Frame Compare)

두 개의 Figma 프레임을 Overlay로 비교하고, 차이점을 텍스트 리포트로 제공하는 Figma Plugin입니다.

## 기술 스택

- **UI**: React 18, TypeScript, Vite, CSS Modules
- **Plugin**: Figma Plugin API, esbuild

## 폴더 구조

```
figma plugin 1/
├── manifest.json          # 플러그인 메타데이터 (Figma가 로드)
├── code.ts                # 플러그인 메인 로직 (선택 감지, Overlay, 리포트 프레임 생성)
├── code.js                # 빌드 산출물 (esbuild)
├── html-embed.generated.ts # 빌드 시 생성 (UI HTML 인라인)
├── src/
│   ├── ui.html            # UI 진입점 HTML
│   ├── main.tsx           # React 진입점
│   ├── App.tsx             # 메인 UI (선택 상태, Opacity, Compare 버튼)
│   ├── App.module.css
│   ├── index.css
│   └── vite-env.d.ts
├── scripts/
│   └── embed-ui.js        # dist → html-embed.generated.ts 생성
├── dist/                  # Vite 빌드 결과 (ui.html, ui.js)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 초기 세팅 명령어

```bash
# 의존성 설치
npm install

# 플러그인 빌드 (UI 빌드 → HTML 인라인 → code.js 번들)
npm run build
```

## 개발

- **UI만 수정할 때**: `npm run build:ui` 후 `node scripts/embed-ui.js` 실행 후 `npm run build:code`. 또는 한 번에 `npm run build`.
- **code.ts만 수정할 때**: `npm run build:code`
- Figma에서 **Plugins → Development → Import plugin from manifest…** 로 이 폴더의 `manifest.json` 선택 후 실행

## 사용 방법

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 **Gemini API 키**를 발급받습니다.
2. 플러그인 UI 상단 **Gemini API 키** 입력란에 키를 붙여넣습니다. (로컬 저장되며 다음 실행 시 유지됩니다.)
3. 캔버스에서 **비교할 프레임 2개**를 선택합니다. (순서: 원본 → 비교 대상)
4. **Opacity** 슬라이더로 두 번째 프레임 투명도를 조절합니다.
5. **Compare frames (Gemini)** 버튼을 누르면 선택된 두 프레임 구조가 Gemini로 전달되고, 매칭률·차이점·수정 가이드가 생성되어 캔버스 우측에 **리포트 프레임**으로 붙습니다.

## 참고

- 비교 분석은 **Google Gemini API** (`gemini-2.0-flash`)를 사용합니다. `manifest.json`의 `networkAccess.allowedDomains`에 `https://generativelanguage.googleapis.com`이 필요합니다.
- API 키는 플러그인 UI에만 저장되며, 서버로 전송되지 않습니다. API 호출은 브라우저(플러그인 iframe)에서 Gemini로 직접 이루어집니다.

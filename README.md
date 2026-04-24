# Frame Compare Offline

Figma에서 **프레임 2개**를 고르면 PNG로 가져와 **캔버스 안에서만** 겹쳐 보기·스와이프·픽셀 차이까지 비교하는 **오프라인** 플러그인입니다. 외부 API나 네트워크 호출 없이 동작합니다.

플러그인 메뉴 이름은 `manifest.json`의 `name`과 같습니다: **Frame Compare Offline**.

---

## 할 수 있는 것

| 영역 | 내용 |
|------|------|
| **선택** | `FRAME` 노드 **정확히 2개** 선택 시에만 비교. 순서대로 A / B. |
| **데이터** | 메인 스레드에서 `exportAsync({ format: "PNG" })`로 추출한 래스터를 UI로 전달. |
| **Opacity** | B(전경) 투명도 슬라이더로 두 이미지 오버레이. |
| **Swipe** | 세로 핸들로 A/B 경계 드래그, 휠·버튼으로 줌, 드래그로 패닝. |
| **Pixel Diff** | 픽셀 단위 차이 영역 검출(민감도·최소 영역·프리셋), A-only / B-only 박스 표시 및 관련 슬라이더. |
| **기타** | A/B Swap, 새로고침, 탭·캔버스 조작에 맞춘 안내 문구(최소 창에서는 짧은 라벨). |
| **창 크기** | 플로팅(280×60) / 최소(600×420) / 기본(900×700) / 최대(1600×1100). 뷰포트가 좁으면 **최소 → 플로팅** 순으로 자동 완화(`mini`·`max` 요청은 유지). |
| **위치** | `figma.ui.resize` 후 가능한 경우 `figma.ui.move`로 화면 안쪽 안전 영역에 배치. |

---

## Figma에서 실행하기

1. **Plugins → Development → Import plugin from manifest…**
2. 이 폴더의 `manifest.json` 선택.
3. **Plugins → Development → Frame Compare Offline** 실행.

- `"main": "code.js"` — 선택 감지, PNG 추출, UI와 `postMessage` 통신  
- `"ui": "ui.html"` — 비교 UI(단일 HTML + 인라인 스크립트)

`code.js`와 `ui.html`을 수정한 뒤 저장하고, 플러그인을 다시 실행하면 반영됩니다.

---

## 사용 순서

1. 비교할 **프레임 두 개**를 선택합니다. (다른 개수면 안내 오버레이만 표시)
2. **Opacity / Swipe / Pixel Diff** 탭으로 모드를 바꿉니다.
3. **플로팅 · 최소 · 기본 · 최대**로 창 크기를 조절합니다. 플로팅 모드에서는 상단 바만 보이고, 그 안 버튼으로 다시 키울 수 있습니다.
4. 필요 시 **A/B Swap**, **새로고침**으로 이미지·선택 상태를 다시 맞춥니다.

---

## 핵심 파일

```
figma plugin 1/
├── manifest.json
├── code.js
├── ui.html
└── DESIGN-apple.md    # UI 가이드(참고)
```

---

## 제한·전제

- 비교 대상은 **`FRAME` 타입**만 카운트합니다.
- **오프라인**: 벡터 구조 분석이나 AI 리포트는 없습니다. **래스터 PNG** 기준 비교입니다.
- `manifest.json`에 `networkAccess`가 없어 **네트워크 권한 없음**이 기본입니다.

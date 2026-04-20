const UI_SIZE_BY_MODE = {
  mini: { width: 280, height: 60 },
  min: { width: 600, height: 420 },
  default: { width: 900, height: 700 },
  max: { width: 1600, height: 1100 }
};
let uiSizeMode = "default";
const SCREEN_SAFE_MARGIN = 100;

figma.showUI(__html__, UI_SIZE_BY_MODE.default);

function postWindowSizeState() {
  figma.ui.postMessage({
    type: "window-size-state",
    mode: uiSizeMode
  });
}

function setWindowSizeMode(mode) {
  if (!Object.prototype.hasOwnProperty.call(UI_SIZE_BY_MODE, mode)) return;
  uiSizeMode = mode;
  const nextSize = UI_SIZE_BY_MODE[mode];
  figma.ui.resize(nextSize.width, nextSize.height);
  // 모드 변경 시마다 우측 하단(100px 마진)으로 고정 배치
  moveUiToSafePosition(nextSize);
  postWindowSizeState();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSafeUiPosition(size) {
  const bounds = figma.viewport && figma.viewport.bounds;
  if (!bounds) return { x: SCREEN_SAFE_MARGIN, y: SCREEN_SAFE_MARGIN };
  const minX = Math.round(bounds.x + SCREEN_SAFE_MARGIN);
  const minY = Math.round(bounds.y + SCREEN_SAFE_MARGIN);
  const preferredX = Math.round(bounds.x + bounds.width - size.width - SCREEN_SAFE_MARGIN);
  const preferredY = Math.round(bounds.y + bounds.height - size.height - SCREEN_SAFE_MARGIN);

  return {
    x: Math.max(minX, preferredX),
    y: Math.max(minY, preferredY)
  };
}

function moveUiToSafePosition(size) {
  const uiWithMove = figma.ui;
  if (!uiWithMove || typeof uiWithMove.move !== "function") return;
  const target = getSafeUiPosition(size);

  const attemptMove = () => {
    try {
      uiWithMove.move(target.x, target.y);
    } catch (_) {
      // move 미지원/실패 환경은 resize만 유지
    }
  };

  attemptMove();
  // 일부 환경에서 resize 직후 move가 무시될 수 있어 짧게 재시도
  setTimeout(attemptMove, 80);
  setTimeout(attemptMove, 180);
}

function getSelectedFrames() {
  return figma.currentPage.selection.filter((n) => n.type === "FRAME").slice(0, 2);
}

function postSelectionState() {
  const frames = getSelectedFrames();
  if (frames.length !== 2) {
    figma.ui.postMessage({
      type: "selection-state",
      ok: false,
      count: frames.length
    });
    return;
  }

  const [frameA, frameB] = frames;
  figma.ui.postMessage({
    type: "selection-state",
    ok: true,
    count: 2,
    names: [frameA.name, frameB.name]
  });
}

async function exportFrame(frame) {
  const bytes = await frame.exportAsync({ format: "PNG" });
  return {
    bytes,
    width: Math.round(frame.width),
    height: Math.round(frame.height),
    name: frame.name
  };
}

async function sendFrameData() {
  const frames = getSelectedFrames();
  if (frames.length !== 2) {
    figma.ui.postMessage({
      type: "selection-state",
      ok: false,
      count: frames.length
    });
    return;
  }

  const [frameA, frameB] = frames;
  figma.ui.postMessage({ type: "loading", message: "분석 중..." });

  try {
    const [a, b] = await Promise.all([exportFrame(frameA), exportFrame(frameB)]);
    figma.ui.postMessage({
      type: "frame-data",
      payload: { a, b }
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "프레임 추출 중 오류가 발생했습니다."
    });
  }
}

figma.on("selectionchange", () => {
  postSelectionState();
  sendFrameData();
});

figma.ui.onmessage = async (msg) => {
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "request-refresh":
      postSelectionState();
      await sendFrameData();
      break;
    case "request-selection-state":
      postSelectionState();
      break;
    case "toggle-window-size":
      setWindowSizeMode(uiSizeMode === "max" ? "default" : "max");
      break;
    case "set-window-size-mode":
      if (typeof msg.mode === "string") {
        setWindowSizeMode(msg.mode);
      }
      break;
    case "request-window-size-state":
      postWindowSizeState();
      break;
    default:
      break;
  }
};

postSelectionState();
sendFrameData();
postWindowSizeState();

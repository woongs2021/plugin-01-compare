const UI_SIZE_BY_MODE = {
  mini: { width: 280, height: 60 },
  min: { width: 600, height: 420 },
  default: { width: 900, height: 700 },
  max: { width: 1600, height: 1100 }
};

let uiSizeMode = "default";
const SCREEN_SAFE_MARGIN = 100;

figma.showUI(__html__, UI_SIZE_BY_MODE.default);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function postWindowSizeState() {
  figma.ui.postMessage({
    type: "window-size-state",
    mode: uiSizeMode
  });
}

function getViewportBounds() {
  const bounds = figma.viewport && figma.viewport.bounds;
  return bounds || null;
}

function getViewportPixelSize() {
  const bounds = getViewportBounds();
  const zoom = figma.viewport && typeof figma.viewport.zoom === "number" ? figma.viewport.zoom : 1;
  if (!bounds) {
    return { width: 1200, height: 800 };
  }
  const width = Math.max(320, Math.round(bounds.width * zoom));
  const height = Math.max(240, Math.round(bounds.height * zoom));
  return { width, height };
}

function getSafeUiPosition(size) {
  const viewportSize = getViewportPixelSize();
  const maxXRaw = viewportSize.width - size.width;
  const maxYRaw = viewportSize.height - size.height;
  const maxX = Math.max(0, maxXRaw);
  const maxY = Math.max(0, maxYRaw);

  const minX = Math.min(SCREEN_SAFE_MARGIN, maxX);
  const minY = Math.min(SCREEN_SAFE_MARGIN, maxY);
  const preferredX = viewportSize.width - size.width - SCREEN_SAFE_MARGIN;
  const preferredY = viewportSize.height - size.height - SCREEN_SAFE_MARGIN;

  return {
    x: clamp(Math.round(preferredX), minX, maxX),
    y: clamp(Math.round(preferredY), minY, maxY)
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
      // 일부 환경에서는 move 미지원
    }
  };

  attemptMove();
  setTimeout(attemptMove, 80);
  setTimeout(attemptMove, 180);
}

function resolveWindowPlacement(requestedMode) {
  const requestedSize = UI_SIZE_BY_MODE[requestedMode];
  if (!requestedSize) {
    return { mode: "default", size: UI_SIZE_BY_MODE.default };
  }
  const viewportSize = getViewportPixelSize();

  if (requestedMode === "mini" || requestedMode === "max") {
    return { mode: requestedMode, size: requestedSize };
  }

  const horizontalRoom = (mode) => {
    const sz = UI_SIZE_BY_MODE[mode];
    return viewportSize.width - sz.width - SCREEN_SAFE_MARGIN * 2;
  };

  if (horizontalRoom(requestedMode) >= 0) {
    return { mode: requestedMode, size: requestedSize };
  }
  if (horizontalRoom("min") >= 0) {
    return { mode: "min", size: UI_SIZE_BY_MODE.min };
  }
  return { mode: "mini", size: UI_SIZE_BY_MODE.mini };
}

function setWindowSizeMode(mode) {
  if (!Object.prototype.hasOwnProperty.call(UI_SIZE_BY_MODE, mode)) return;

  const resolved = resolveWindowPlacement(mode);
  uiSizeMode = resolved.mode;
  const nextSize = resolved.size;

  figma.ui.resize(nextSize.width, nextSize.height);
  moveUiToSafePosition(nextSize);
  postWindowSizeState();
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


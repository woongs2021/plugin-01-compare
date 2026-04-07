/**
 * Figma Plugin: Frame Compare (피그마 검증 툴)
 * - 선택된 두 프레임 Overlay 비교
 * - UI와 postMessage로 통신
 */

import { __html__ } from './html-embed.generated'

/** UI로 보낼 때 사용하는 직렬화 가능한 프레임 정보 */
type SerializedNode = {
  name: string
  type: string
  width?: number
  height?: number
  x?: number
  y?: number
  fills?: string
  fontSize?: number
  characters?: string
  children?: SerializedNode[]
}

type MessageFromUI =
  | { type: 'getSelection' }
  | { type: 'setOverlayOpacity'; opacity: number }
  | { type: 'getFrameData' }
  | { type: 'compareFrames'; payload: { matchRate: number; differences: string; guidelines: string } }

type MessageToUI =
  | { type: 'selectionChange'; count: number; frameIds: [string, string] | null }
  | { type: 'overlayApplied' }
  | { type: 'frameData'; data: { frameA: SerializedNode; frameB: SerializedNode } }
  | { type: 'reportCreated'; frameId: string }
  | { type: 'reportError'; message: string }

function getSelectedFrameNodes(): FrameNode[] {
  const selection = figma.currentPage.selection
  const frames = selection.filter((node): node is FrameNode => node.type === 'FRAME')
  return frames.slice(0, 2)
}

function serializeNode(node: SceneNode, parentX = 0, parentY = 0): SerializedNode {
  const base: SerializedNode = {
    name: node.name,
    type: node.type,
  }
  if ('width' in node && 'height' in node) {
    base.width = node.width
    base.height = node.height
  }
  if ('x' in node && 'y' in node) {
    base.x = node.x
    base.y = node.y
  }
  if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
    const solid = node.fills.find((f) => f.type === 'SOLID') as SolidPaint | undefined
    if (solid && solid.color) {
      const { r, g, b } = solid.color
      base.fills = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
    }
  }
  if (node.type === 'TEXT' && 'characters' in node) {
    const chars = (node as TextNode).characters
    base.characters = chars != null ? String(chars).slice(0, 200) : ''
    base.fontSize = typeof (node as TextNode).fontSize === 'number' ? (node as TextNode).fontSize : undefined
  }
  if ('children' in node && node.children && node.children.length) {
    base.children = node.children.map((child) => serializeNode(child, 'x' in node ? node.x : 0, 'y' in node ? node.y : 0))
  }
  return base
}

function notifySelectionToUI() {
  const frames = getSelectedFrameNodes()
  const payload: MessageToUI =
    frames.length === 2
      ? { type: 'selectionChange', count: 2, frameIds: [frames[0].id, frames[1].id] }
      : { type: 'selectionChange', count: frames.length, frameIds: null }
  figma.ui.postMessage(payload)
}

function applyOverlay(opacity: number) {
  const frames = getSelectedFrameNodes()
  if (frames.length !== 2) return
  const [original, compare] = frames
  compare.x = original.x
  compare.y = original.y
  compare.opacity = opacity / 100
  figma.ui.postMessage({ type: 'overlayApplied' } as MessageToUI)
}

async function createReportFrame(report: { matchRate: number; differences: string; guidelines: string }) {
  const frames = getSelectedFrameNodes()
  if (frames.length !== 2) return
  const [original] = frames
  const width = 340
  const padding = 16
  const reportFrame = figma.createFrame()
  reportFrame.name = 'Frame Compare Report'
  reportFrame.x = original.x + original.width + 24
  reportFrame.y = original.y
  reportFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
  reportFrame.cornerRadius = 8
  reportFrame.effects = []

  const fontName = { family: 'Inter', style: 'Regular' }
  await figma.loadFontAsync(fontName)

  let y = padding

  const title = figma.createText()
  title.characters = '비교 리포트'
  title.fontName = fontName
  title.fontSize = 18
  title.x = padding
  title.y = y
  reportFrame.appendChild(title)
  y += 28

  const matchLabel = figma.createText()
  matchLabel.characters = `매칭률: ${report.matchRate}%`
  matchLabel.fontName = fontName
  matchLabel.fontSize = 14
  matchLabel.x = padding
  matchLabel.y = y
  reportFrame.appendChild(matchLabel)
  y += 24

  const textWidth = width - padding * 2
  const diffLabel = figma.createText()
  diffLabel.characters = '차이점:\n' + report.differences
  diffLabel.fontName = fontName
  diffLabel.fontSize = 12
  diffLabel.x = padding
  diffLabel.y = y
  diffLabel.resize(textWidth, 120)
  diffLabel.textAlignVertical = 'TOP'
  if (diffLabel.textSizingMode !== undefined) {
    diffLabel.textSizingMode = 'AUTO_HEIGHT'
  }
  reportFrame.appendChild(diffLabel)
  y += diffLabel.height + 12

  const guideLabel = figma.createText()
  guideLabel.characters = '수정 가이드:\n' + report.guidelines
  guideLabel.fontName = fontName
  guideLabel.fontSize = 12
  guideLabel.x = padding
  guideLabel.y = y
  guideLabel.resize(textWidth, 120)
  guideLabel.textAlignVertical = 'TOP'
  if (guideLabel.textSizingMode !== undefined) {
    guideLabel.textSizingMode = 'AUTO_HEIGHT'
  }
  reportFrame.appendChild(guideLabel)
  y += guideLabel.height + padding

  reportFrame.resize(width, Math.max(320, y))

  figma.currentPage.appendChild(reportFrame)
  figma.currentPage.selection = [reportFrame]
  figma.viewport.scrollAndZoomIntoView([reportFrame])
  figma.ui.postMessage({ type: 'reportCreated', frameId: reportFrame.id } as MessageToUI)
}

figma.showUI(__html__, { width: 360, height: 480 })

notifySelectionToUI()
figma.on('selectionchange', notifySelectionToUI)

function sendFrameDataToUI() {
  const frames = getSelectedFrameNodes()
  if (frames.length !== 2) return
  figma.ui.postMessage({
    type: 'frameData',
    data: {
      frameA: serializeNode(frames[0]),
      frameB: serializeNode(frames[1]),
    },
  } as MessageToUI)
}

figma.ui.onmessage = async (msg: MessageFromUI) => {
  switch (msg.type) {
    case 'getSelection':
      notifySelectionToUI()
      break
    case 'setOverlayOpacity':
      applyOverlay(msg.opacity)
      break
    case 'getFrameData':
      sendFrameDataToUI()
      break
    case 'compareFrames':
      try {
        await createReportFrame(msg.payload)
      } catch (e) {
        figma.ui.postMessage({
          type: 'reportError',
          message: e instanceof Error ? e.message : '리포트 생성에 실패했습니다.',
        } as MessageToUI)
      }
      break
  }
}

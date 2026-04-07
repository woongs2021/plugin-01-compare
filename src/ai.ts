/**
 * 공통 타입 및 프롬프트 – Gemini / Groq 등에서 공유
 */

export type SerializedNode = {
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

export type ReportPayload = {
  matchRate: number
  differences: string
  guidelines: string
}

/** Groq 등 토큰 한도가 있는 API용 – 프레임 데이터를 크기 제한으로 잘라 냄 (depth/children/텍스트 길이 제한) */
export function truncateFrameForPrompt(node: SerializedNode, _maxChars: number): SerializedNode {
  const maxDepth = 2
  const maxChildren = 3
  const maxTextLen = 40
  const maxNameLen = 30

  function go(n: SerializedNode, depth: number): SerializedNode {
    const out: SerializedNode = {
      name: n.name.length > maxNameLen ? n.name.slice(0, maxNameLen) + '…' : n.name,
      type: n.type,
    }
    if (n.width != null) out.width = n.width
    if (n.height != null) out.height = n.height
    if (n.x != null) out.x = n.x
    if (n.y != null) out.y = n.y
    if (n.fills != null) out.fills = n.fills
    if (n.fontSize != null) out.fontSize = n.fontSize
    if (n.characters != null)
      out.characters = n.characters.slice(0, maxTextLen) + (n.characters.length > maxTextLen ? '…' : '')
    if (depth < maxDepth && n.children && n.children.length > 0) {
      out.children = n.children.slice(0, maxChildren).map((c) => go(c, depth + 1))
    }
    return out
  }
  return go(node, 0)
}

export function buildPrompt(frameA: SerializedNode, frameB: SerializedNode): string {
  return `당신은 Figma 디자인 검증 전문가입니다. 아래 두 프레임(원본 A, 비교대상 B)의 JSON 구조를 비교하여 리포트를 작성해 주세요.

## 프레임 A (원본)
\`\`\`json
${JSON.stringify(frameA, null, 2)}
\`\`\`

## 프레임 B (비교 대상)
\`\`\`json
${JSON.stringify(frameB, null, 2)}
\`\`\`

다음 JSON만 한 줄로 응답하세요. 다른 설명은 넣지 마세요.
{
  "matchRate": 0에서 100 사이 숫자,
  "differences": "차이점을 bullet(•)으로 나열. 색상, 폰트, 간격, 레이아웃 등 구체적으로",
  "guidelines": "비교대상(B)을 원본(A)처럼 만들기 위한 수정 가이드. 번호로 나열하고 Actionable하게"
}`
}

/** 잘린 소수(예: "78.")를 "78.0"으로 보정해 JSON 파싱 오류 방지 */
function fixTruncatedNumbers(jsonStr: string): string {
  return jsonStr.replace(/(\d+)\.(?=[,\]}\s]|$)/g, '$1.0')
}

/** JSON 문자열 리터럴 안의 제어 문자(줄바꿈·탭 등)를 이스케이프해 파싱 오류 방지 */
function escapeControlCharsInJsonStrings(jsonStr: string): string {
  let result = ''
  let inString = false
  let escapeNext = false
  for (let i = 0; i < jsonStr.length; i++) {
    const c = jsonStr[i]
    if (escapeNext) {
      result += c
      escapeNext = false
      continue
    }
    if (c === '\\' && inString) {
      result += c
      escapeNext = true
      continue
    }
    if (c === '"') {
      inString = !inString
      result += c
      continue
    }
    if (inString && c >= '\u0000' && c <= '\u001F') {
      if (c === '\n') result += '\\n'
      else if (c === '\r') result += '\\r'
      else if (c === '\t') result += '\\t'
      else result += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
      continue
    }
    result += c
  }
  return result
}

export function parseReportResponse(text: string): ReportPayload {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  let jsonStr = jsonMatch ? jsonMatch[0] : text
  jsonStr = escapeControlCharsInJsonStrings(jsonStr)
  jsonStr = fixTruncatedNumbers(jsonStr)
  let parsed: ReportPayload
  try {
    parsed = JSON.parse(jsonStr) as ReportPayload
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AI 응답 JSON 파싱 실패(잘린 응답일 수 있음): ${msg}`)
  }
  if (
    typeof parsed.matchRate !== 'number' ||
    typeof parsed.differences !== 'string' ||
    typeof parsed.guidelines !== 'string'
  ) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.')
  }
  return {
    matchRate: Math.min(100, Math.max(0, parsed.matchRate)),
    differences: String(parsed.differences),
    guidelines: String(parsed.guidelines),
  }
}

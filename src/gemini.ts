/**
 * Google Gemini API 연동
 */
import { buildPrompt, parseReportResponse, type ReportPayload, type SerializedNode } from './ai'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODELS_TO_TRY = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']

export type { ReportPayload, SerializedNode } from './ai'

function parse429Message(body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { details?: Array<{ '@type'?: string; retryDelay?: string }> }
    }
    const details = json.error?.details ?? []
    const retryInfo = details.find((d) => (d['@type'] ?? '').includes('RetryInfo'))
    const retrySec = retryInfo?.retryDelay?.replace(/s$/i, '').trim() ?? '24'
    return `요청 한도를 초과했습니다. 약 ${retrySec}초 후 다시 시도하거나, Google AI Studio에서 결제/한도를 확인해 주세요.`
  } catch {
    // ignore
  }
  return '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
}

export async function generateComparisonReport(
  apiKey: string,
  frameA: SerializedNode,
  frameB: SerializedNode
): Promise<ReportPayload> {
  const prompt = buildPrompt(frameA, frameB)
  let lastError: Error | null = null

  for (const model of MODELS_TO_TRY) {
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text?.trim()) ?? ''
      if (!text) {
        lastError = new Error('Gemini가 응답 텍스트를 반환하지 않았습니다.')
        continue
      }
      return parseReportResponse(text)
    }

    const errText = await res.text()
    if (res.status === 429) {
      lastError = new Error(parse429Message(errText))
      continue
    }
    lastError = new Error(`Gemini API 오류 (${res.status}): ${errText.slice(0, 200)}`)
  }

  throw lastError ?? new Error('비교 분석에 실패했습니다.')
}

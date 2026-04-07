/**
 * Groq API 연동 (Llama 모델, 무료 티어) – TPM 한도 6000 이하로 프레임 데이터 축약 후 전송
 */
import { buildPrompt, parseReportResponse, truncateFrameForPrompt, type ReportPayload, type SerializedNode } from './ai'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'
const MAX_CHARS_PER_FRAME = 2200

export type { ReportPayload, SerializedNode } from './ai'

export async function generateComparisonReportGroq(
  apiKey: string,
  frameA: SerializedNode,
  frameB: SerializedNode
): Promise<ReportPayload> {
  const smallA = truncateFrameForPrompt(frameA, MAX_CHARS_PER_FRAME)
  const smallB = truncateFrameForPrompt(frameB, MAX_CHARS_PER_FRAME)
  const prompt = buildPrompt(smallA, smallB)
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = `Groq API 오류 (${res.status})`
    try {
      const j = JSON.parse(errText) as { error?: { message?: string } }
      if (j.error?.message) msg += ': ' + j.error.message
    } catch {
      if (errText.length < 150) msg += ': ' + errText
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) throw new Error('Groq가 응답 텍스트를 반환하지 않았습니다.')

  return parseReportResponse(text)
}

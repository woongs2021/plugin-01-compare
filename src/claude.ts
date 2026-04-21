/**
 * Anthropic Claude API 연동
 */
import { buildPrompt, parseReportResponse, type ReportPayload, type SerializedNode } from './ai'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-3-5-sonnet-20241022'

export type { ReportPayload, SerializedNode } from './ai'

export async function generateComparisonReportClaude(
  apiKey: string,
  frameA: SerializedNode,
  frameB: SerializedNode,
): Promise<ReportPayload> {
  const prompt = buildPrompt(frameA, frameB)
  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = `Claude API 오류 (${res.status})`
    try {
      const j = JSON.parse(errText) as { error?: { message?: string } }
      if (j.error?.message) msg += ': ' + j.error.message
    } catch {
      if (errText.length < 200) msg += ': ' + errText
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const text =
    data.content?.find((part) => part.type === 'text')?.text?.trim() ??
    data.content?.[0]?.text?.trim() ??
    ''
  if (!text) throw new Error('Claude가 응답 텍스트를 반환하지 않았습니다.')

  return parseReportResponse(text)
}


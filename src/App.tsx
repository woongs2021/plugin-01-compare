import { useState, useEffect, useCallback } from 'react'
import { generateComparisonReport, type ReportPayload, type SerializedNode } from './gemini'
import { generateComparisonReportGroq } from './groq'
import { generateComparisonReportClaude } from './claude'
import styles from './App.module.css'

const GEMINI_KEY_STORAGE = 'figma-frame-compare-gemini-api-key'
const GROQ_KEY_STORAGE = 'figma-frame-compare-groq-api-key'
const CLAUDE_KEY_STORAGE = 'figma-frame-compare-claude-api-key'
const PROVIDER_STORAGE = 'figma-frame-compare-provider'

type Provider = 'mock' | 'gemini' | 'groq' | 'claude'

function getMockReport(): ReportPayload {
  return {
    matchRate: 78,
    differences:
      '• 버튼 배경색: 원본 #2563EB vs 비교 #3B82F6\n• 제목 폰트 크기: 원본 24px vs 비교 20px\n• 카드 간격: 원본 16px vs 비교 24px\n• 아이콘 크기: 원본 24x24 vs 비교 20x20',
    guidelines:
      '1. 버튼 fill을 #2563EB로 변경\n2. 제목 텍스트 fontSize를 24로 설정\n3. Auto layout spacing을 16으로 조정\n4. 아이콘 프레임 크기를 24x24로 변경',
  }
}

type SelectionState = {
  count: number
  frameIds: [string, string] | null
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading'; scale: number }
  | { status: 'ready'; scale: number; frameAUrl: string; frameBUrl: string }
  | { status: 'error'; message: string }

export default function App() {
  const [selection, setSelection] = useState<SelectionState>({ count: 0, frameIds: null })
  const [provider, setProvider] = useState<Provider>(() => {
    try {
      const v = localStorage.getItem(PROVIDER_STORAGE) as Provider | null
      return v === 'gemini' || v === 'groq' || v === 'claude' ? v : 'mock'
    } catch {
      return 'mock'
    }
  })
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem(GEMINI_KEY_STORAGE) ?? ''
    } catch {
      return ''
    }
  })
  const [groqKey, setGroqKey] = useState(() => {
    try {
      return localStorage.getItem(GROQ_KEY_STORAGE) ?? ''
    } catch {
      return ''
    }
  })
  const [claudeKey, setClaudeKey] = useState(() => {
    try {
      return localStorage.getItem(CLAUDE_KEY_STORAGE) ?? ''
    } catch {
      return ''
    }
  })
  const [opacity, setOpacity] = useState(60)
  const [isComparing, setIsComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [previewScale, setPreviewScale] = useState(1)

  const isActive = selection.count === 2 && selection.frameIds !== null

  const sendToFigma = useCallback((payload: unknown) => {
    parent.postMessage({ pluginMessage: payload }, '*')
  }, [])

  const requestPreview = useCallback(
    (scale?: number) => {
      if (!isActive) return
      const s = scale ?? previewScale
      setPreview({ status: 'loading', scale: s })
      sendToFigma({ type: 'getPreviewImages', scale: s })
    },
    [isActive, previewScale, sendToFigma],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.pluginMessage == null) return
      const msg = event.data.pluginMessage
      if (msg.type === 'selectionChange') {
        setSelection({
          count: msg.count,
          frameIds: msg.frameIds ?? null,
        })
      }
      if (msg.type === 'previewImages') {
        setPreview({
          status: 'ready',
          scale: msg.data?.scale ?? 1,
          frameAUrl: msg.data?.frameAUrl ?? '',
          frameBUrl: msg.data?.frameBUrl ?? '',
        })
      }
      if (msg.type === 'previewError') {
        setPreview({ status: 'error', message: msg.message ?? '프리뷰 생성에 실패했습니다.' })
      }
      if (msg.type === 'reportError') {
        setError(msg.message ?? '리포트 생성에 실패했습니다.')
      }
    }
    window.addEventListener('message', onMessage)
    sendToFigma({ type: 'getSelection' })
    return () => window.removeEventListener('message', onMessage)
  }, [sendToFigma])

  useEffect(() => {
    if (!isActive) {
      setPreview({ status: 'idle' })
      return
    }
    requestPreview()
  }, [isActive, requestPreview, selection.frameIds])

  useEffect(() => {
    try {
      localStorage.setItem(PROVIDER_STORAGE, provider)
      if (apiKey) localStorage.setItem(GEMINI_KEY_STORAGE, apiKey)
      if (groqKey) localStorage.setItem(GROQ_KEY_STORAGE, groqKey)
      if (claudeKey) localStorage.setItem(CLAUDE_KEY_STORAGE, claudeKey)
    } catch {
      // ignore
    }
  }, [provider, apiKey, groqKey, claudeKey])

  const handleCompare = useCallback(async () => {
    if (!isActive) return
    if (provider === 'gemini' && !apiKey.trim()) {
      setError('Gemini API 키를 입력하거나, AI 제공자를 Groq/Mock으로 바꿔 주세요.')
      return
    }
    if (provider === 'groq' && !groqKey.trim()) {
      setError('Groq API 키를 입력해 주세요. console.groq.com 에서 무료 발급.')
      return
    }
    if (provider === 'claude' && !claudeKey.trim()) {
      setError('Claude API 키를 입력해 주세요. (sk-ant-...)')
      return
    }
    setError(null)
    setIsComparing(true)
    try {
      if (provider === 'mock') {
        await new Promise((r) => setTimeout(r, 400))
        sendToFigma({ type: 'compareFrames', payload: getMockReport() })
      } else {
        const resolveFrameData = new Promise<{ frameA: SerializedNode; frameB: SerializedNode }>((resolve, reject) => {
          const handler = (event: MessageEvent) => {
            if (event.data?.pluginMessage?.type === 'frameData') {
              window.removeEventListener('message', handler)
              clearTimeout(timer)
              resolve(event.data.pluginMessage.data)
            }
          }
          window.addEventListener('message', handler)
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler)
            reject(new Error('프레임 데이터를 받지 못했습니다.'))
          }, 5000)
        })
        sendToFigma({ type: 'getFrameData' })
        const { frameA, frameB } = await resolveFrameData
        const report: ReportPayload =
          provider === 'groq'
            ? await generateComparisonReportGroq(groqKey.trim(), frameA, frameB)
            : provider === 'claude'
              ? await generateComparisonReportClaude(claudeKey.trim(), frameA, frameB)
              : await generateComparisonReport(apiKey.trim(), frameA, frameB)
        sendToFigma({ type: 'compareFrames', payload: report })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '비교 분석 중 오류가 발생했습니다.')
    } finally {
      setIsComparing(false)
    }
  }, [isActive, provider, apiKey, groqKey, claudeKey, sendToFigma])

  const needKey = provider === 'gemini' || provider === 'groq' || provider === 'claude'
  const buttonLabel =
    provider === 'mock'
      ? 'Compare frames (테스트)'
      : provider === 'groq'
        ? 'Compare frames (Groq)'
      : provider === 'claude'
        ? 'Compare frames (Claude)'
        : 'Compare frames (Gemini)'

  return (
    <div className={styles.layout}>
      <h1 className={styles.title}>
        {isActive ? 'Frame Compare' : 'No selected frames'}
      </h1>

      <section className={`${styles.section} ${styles.growSection}`} aria-label="Preview" data-disabled={!isActive}>
        <label className={styles.label}>
          오버레이 프리뷰
          <span className={styles.optional}>캔버스 변경 없음</span>
        </label>
        <div className={styles.previewWrap}>
          <div className={styles.previewStage}>
            {preview.status === 'ready' && (
              <>
                <img className={styles.previewImg} src={preview.frameAUrl} alt="Frame A" />
                <img className={styles.previewImg} src={preview.frameBUrl} alt="Frame B overlay" style={{ opacity: opacity / 100 }} />
              </>
            )}
            {preview.status === 'loading' && <p className={styles.hint} style={{ padding: 8 }}>프리뷰 생성 중…</p>}
            {preview.status === 'error' && <p className={styles.error} style={{ padding: 8 }}>{preview.message}</p>}
            {preview.status === 'idle' && <p className={styles.hint} style={{ padding: 8 }}>프레임 2개를 선택하면 프리뷰가 표시됩니다.</p>}
          </div>
          <div className={styles.previewFooter}>
            <select
              className={styles.select}
              value={previewScale}
              onChange={(e) => setPreviewScale(Number(e.target.value))}
              aria-label="Preview scale"
              style={{ width: 140 }}
              disabled={!isActive}
            >
              <option value={0.5}>해상도 0.5x</option>
              <option value={1}>해상도 1x</option>
              <option value={2}>해상도 2x</option>
            </select>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => requestPreview(previewScale)}
              disabled={!isActive || preview.status === 'loading'}
            >
              새로고침
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <label className={styles.label}>AI 제공자</label>
        <select
          className={styles.select}
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
        >
          <option value="mock">Mock (무료 테스트)</option>
          <option value="groq">Groq (무료 추천, Llama)</option>
          <option value="claude">Claude (Anthropic)</option>
          <option value="gemini">Gemini (Google)</option>
        </select>
      </section>

      {provider === 'gemini' && (
        <section className={styles.section}>
          <label className={styles.label}>
            Gemini API 키
            <span className={styles.optional}>(저장됨)</span>
          </label>
          <input
            type="password"
            className={styles.input}
            placeholder="AIza..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </section>
      )}

      {provider === 'groq' && (
        <section className={styles.section}>
          <label className={styles.label}>
            Groq API 키
            <span className={styles.optional}>(저장됨, console.groq.com)</span>
          </label>
          <input
            type="password"
            className={styles.input}
            placeholder="gsk_..."
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            autoComplete="off"
          />
        </section>
      )}
      {provider === 'claude' && (
        <section className={styles.section}>
          <label className={styles.label}>
            Claude API 키
            <span className={styles.optional}>(저장됨, console.anthropic.com)</span>
          </label>
          <input
            type="password"
            className={styles.input}
            placeholder="sk-ant-..."
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
            autoComplete="off"
          />
        </section>
      )}

      <section className={styles.section} aria-label="Overlay opacity" data-disabled={!isActive}>
        <label className={styles.label}>
          비교 프레임 Opacity
          <span className={styles.value}>{opacity}%</span>
        </label>
        <input
          type="range"
          min={10}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className={styles.slider}
          disabled={!isActive}
        />
      </section>

      <section className={styles.section} data-disabled={!isActive}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleCompare}
          disabled={
            !isActive ||
            isComparing ||
            (needKey && provider === 'gemini' && !apiKey.trim()) ||
            (needKey && provider === 'groq' && !groqKey.trim()) ||
            (needKey && provider === 'claude' && !claudeKey.trim())
          }
        >
          {isComparing ? '분석 중…' : buttonLabel}
        </button>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {!isActive && (
        <p className={styles.hint}>
          캔버스에서 비교할 프레임 2개를 선택해 주세요.
        </p>
      )}
    </div>
  )
}

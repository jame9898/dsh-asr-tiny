import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { TARGET_SAMPLE_RATE, blobToPcm, encodeWav, mergePcm } from './audio.ts'
import { readAsrBase } from './prefs.ts'
import { joinDraft, normalizeAsrText } from './text.ts'
import css from './CollectorButton.module.css'

/** Upper bound for one ASR/save round-trip before the UI reports a timeout. */
const REQUEST_TIMEOUT_MS = 30_000
/** The sample-count probe must never block the panel. */
const COUNT_TIMEOUT_MS = 5_000

/** Composer input action surface (injected by the standard kit). */
export interface VoiceInputActions {
  setDraft(text: string): void
}

/** 会话输入状态（slot 标准 seat 中我们读取的子集）。 */
export interface ComposerInputState {
  readonly draft: string
}

type Phase = 'idle' | 'recording' | 'transcribing' | 'saving'

interface LastClip {
  /** One 16 kHz mono PCM track per dictated segment; merged only on save. */
  chunks: Float32Array<ArrayBuffer>[]
  /** Raw ASR text of each segment, in dictation order. */
  asrParts: string[]
}

interface Notice {
  kind: 'ok' | 'error'
  text: string
}

/** Whether the failure came from a request/response timeout rather than the service. */
function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

export type CollectorButtonProps = {
  inputActions: VoiceInputActions
  /**
   * 会话输入选择器 Hook。由 conversation slot host 通过 uiSession.provide 的
   * 标准 seat 注入（0.1 与 0.2 均提供），这里无条件调用以满足 hooks 规则。
   */
  useInput: <T>(selector: (state: ComposerInputState) => T) => T | undefined
} & PropsLocale<'voice.collector'>

export function CollectorButton({ inputActions, useInput, t }: CollectorButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [sampleCount, setSampleCount] = useState(0)
  const [hasClip, setHasClip] = useState(false)

  // 读 composer 草稿：标准 seat 的选择器 Hook（slot 内恒存在）。
  const inputState = useInput((state) => state)
  const draft = inputState?.draft ?? ''

  // recorder.onstop 在之后异步触发时读这份最新草稿，避免拼到过期快照上。
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const busyRef = useRef(false)
  const lastClipRef = useRef<LastClip | null>(null)
  /** 上一次保存时输入框里的文本：保存后不清空草稿，下一次样本只取它之后新增的部分。 */
  const savedPrefixRef = useRef('')
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashNotice = (kind: Notice['kind'], text: string): void => {
    if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current)
    setNotice({ kind, text })
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null)
      noticeTimerRef.current = null
    }, 3000)
  }

  /** Probe the current sample count; failures leave the panel usable. */
  const loadSampleCount = async (): Promise<void> => {
    try {
      const response = await fetch(`${readAsrBase()}/samples`, { signal: AbortSignal.timeout(COUNT_TIMEOUT_MS) })
      if (!response.ok) return
      const body = (await response.json()) as { count?: unknown }
      setSampleCount(typeof body.count === 'number' ? body.count : 0)
    } catch {
      /* service offline */
    }
  }

  useEffect(() => {
    void loadSampleCount()
  }, [])

  // Tear down on unmount: stop any live mic, clear the notice timer.
  useEffect(() => () => {
    if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current)
    if (mediaRef.current && mediaRef.current.state === 'recording') mediaRef.current.stop()
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
  }, [])

  const finalizeRecording = async (mimeType: string): Promise<void> => {
    if (busyRef.current) return
    busyRef.current = true
    let stage: 'decode' | 'request' = 'decode'
    try {
      setPhase('transcribing')
      const recorded = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      const samples = await blobToPcm(recorded)
      stage = 'request'
      const form = new FormData()
      form.append('file', encodeWav(samples, TARGET_SAMPLE_RATE), 'clip.wav')
      const resp = await fetch(`${readAsrBase()}/transcribe`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = (await resp.json()) as { text?: unknown }
      const text = normalizeAsrText(typeof json.text === 'string' ? json.text : '')
      if (text !== '') {
        // 连续听写：文本追加到已有草稿之后，音频按段累计，保存时再合并成同一条样本。
        const prev = lastClipRef.current
        lastClipRef.current = {
          chunks: [...(prev?.chunks ?? []), samples],
          asrParts: [...(prev?.asrParts ?? []), text],
        }
        setHasClip(true)
        inputActions.setDraft(joinDraft(draftRef.current, text))
      } else {
        flashNotice('error', t('noSpeech'))
      }
      setPhase('idle')
    } catch (error) {
      flashNotice('error', t(isTimeoutError(error) ? 'timeout' : stage === 'decode' ? 'decodeFailed' : 'transcribeFailed'))
      setPhase('idle')
    } finally {
      busyRef.current = false
    }
  }

  const startRecording = async (): Promise<void> => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      flashNotice('error', t('micDenied'))
      return
    }
    try {
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        stream.getTracks().forEach((tr) => tr.stop())
        if (streamRef.current === stream) streamRef.current = null
        void finalizeRecording(mimeType)
      }
      mediaRef.current = recorder
      streamRef.current = stream
      recorder.start()
    } catch {
      // Never leave the capture stream live when the recorder refuses to start.
      stream.getTracks().forEach((tr) => tr.stop())
      mediaRef.current = null
      streamRef.current = null
      flashNotice('error', t('recorderFailed'))
      return
    }
    setPhase('recording')
  }

  const stopRecording = (): void => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop()
    }
  }

  const clearInput = (): void => {
    // 清空即重置本次采集：文本与已累计音频一起丢弃，避免保存时文本/音频错配。
    inputActions.setDraft('')
    lastClipRef.current = null
    savedPrefixRef.current = ''
    setHasClip(false)
  }

  const saveSample = async (): Promise<void> => {
    const clip = lastClipRef.current
    if (!clip || busyRef.current) return
    const asrHyp = clip.asrParts.reduce((acc, part) => joinDraft(acc, part), '')
    // 保存只消费「上一次保存之后」新增的听写：草稿保留原文（可能还要发送），
    // 若草稿仍以上次保存的文本开头，就只取其后新增的部分，保证样本音频/文本对应。
    const draftRaw = draftRef.current
    const prefix = savedPrefixRef.current
    const dictated = prefix !== '' && draftRaw.startsWith(prefix)
      ? draftRaw.slice(prefix.length).trim()
      : draftRaw.trim()
    const text = dictated || asrHyp.trim()
    if (!text) {
      flashNotice('error', t('noSpeech'))
      return
    }
    busyRef.current = true
    setPhase('saving')
    try {
      const merged = mergePcm(clip.chunks)
      const form = new FormData()
      form.append('text', text)
      form.append('asr_hyp', asrHyp)
      form.append('duration_s', String(merged.length / TARGET_SAMPLE_RATE))
      form.append('file', encodeWav(merged, TARGET_SAMPLE_RATE), 'clip.wav')
      const resp = await fetch(`${readAsrBase()}/samples`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = (await resp.json()) as { ok?: unknown }
      if (json.ok) {
        lastClipRef.current = null
        // 只清空音频；输入框文字保留（可能还没发送），并记住这段文本已作为样本保存过。
        savedPrefixRef.current = draftRaw
        setHasClip(false)
        void loadSampleCount()
        flashNotice('ok', t('saved'))
      } else {
        flashNotice('error', t('saveFailed'))
      }
    } catch (error) {
      flashNotice('error', t(isTimeoutError(error) ? 'timeout' : 'saveFailed'))
    } finally {
      busyRef.current = false
      setPhase('idle')
    }
  }

  const recording = phase === 'recording'
  const transcribing = phase === 'transcribing'
  const saving = phase === 'saving'
  const busy = transcribing || saving
  const canSave = phase === 'idle' && hasClip
  const hasDraft = draft.length > 0
  const micTitle = recording ? t('stop') : t('record')

  return (
    <div className={css.wrap}>
      {notice !== null && (
        <div
          className={notice.kind === 'error' ? css.noticeError : css.noticeOk}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </div>
      )}
      <div className={css.pill} role="group" aria-label={t('title')}>
        <button
          type="button"
          className={recording ? css.btnActive : css.btn}
          aria-label={micTitle}
          aria-pressed={recording}
          title={micTitle}
          disabled={busy}
          onClick={() => {
            if (recording) stopRecording()
            else void startRecording()
          }}
        >
          {transcribing ? (
            <span className={css.spinner} />
          ) : recording ? (
            <span className={css.eq} aria-hidden="true">
              <i /><i /><i />
            </span>
          ) : (
            <svg className={css.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-2.06A8 8 0 0 0 20 12h-2Z"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className={css.btn}
          aria-label={t('clear')}
          title={t('clear')}
          disabled={!hasDraft}
          onClick={clearInput}
        >
          <svg className={css.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"
            />
          </svg>
        </button>
        <button
          type="button"
          className={notice?.kind === 'ok' ? css.btnSaved : css.btn}
          aria-label={t('save')}
          title={`${t('save')} (${t('collected')} ${sampleCount})`}
          disabled={!canSave}
          onClick={() => { void saveSample() }}
        >
          {saving ? (
            <span className={css.spinner} />
          ) : (
            <svg className={css.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M5 4a1 1 0 0 1 1-1h10l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4Zm4 0v4h5V4H9Zm-2 7v6h10v-6H7Zm2-2h6v2H9V9Z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

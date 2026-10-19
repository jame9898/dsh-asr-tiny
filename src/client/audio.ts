/**
 * Browser audio helpers: decode a MediaRecorder blob into 16 kHz mono PCM,
 * merge dictated segments without repeated whole-buffer copies, and encode the
 * PCM the training pipeline expects.
 */

/** The training pipeline (finetune-moonshine-asr) strictly requires 16 kHz mono WAV. */
export const TARGET_SAMPLE_RATE = 16000

/** Silence inserted between separately dictated segments so the merged sample stays intelligible. */
export const SEGMENT_GAP_S = 0.2

/** Decode a recorded blob into an AudioBuffer. No object URL is created, so nothing leaks. */
function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('audio read failed'))
    reader.onload = () => {
      const ctx = new AudioContext()
      const close = (): void => { void ctx.close().catch(() => {}) }
      ctx.decodeAudioData(reader.result as ArrayBuffer)
        .then((buf) => { close(); resolve(buf) })
        .catch((err) => { close(); reject(err instanceof Error ? err : new Error('audio decode failed')) })
    }
    reader.readAsArrayBuffer(blob)
  })
}

/** Average every channel into a single mono track (keeps voice, drops stereo offset). */
function downmixToMono(buffer: AudioBuffer): Float32Array<ArrayBuffer> {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice()
  const length = buffer.length
  const out = new Float32Array(length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) + data[i]! / buffer.numberOfChannels
  }
  return out
}

/** Resample a mono track to the target rate (no-op when already matching). */
async function resampleTo(samples: Float32Array<ArrayBuffer>, fromRate: number, toRate: number): Promise<Float32Array<ArrayBuffer>> {
  if (fromRate === toRate) return samples
  const length = Math.max(1, Math.ceil(samples.length * toRate / fromRate))
  const offline = new OfflineAudioContext(1, length, toRate)
  const sourceBuffer = offline.createBuffer(1, samples.length, fromRate)
  sourceBuffer.copyToChannel(samples, 0)
  const source = offline.createBufferSource()
  source.buffer = sourceBuffer
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}

/** Decode a recorded blob into 16 kHz mono PCM (the training pipeline's format). */
export async function blobToPcm(blob: Blob): Promise<Float32Array<ArrayBuffer>> {
  const buffer = await decodeAudio(blob)
  const mono = downmixToMono(buffer)
  return resampleTo(mono, buffer.sampleRate, TARGET_SAMPLE_RATE)
}

/**
 * Merge dictated segments into one track, inserting a short silence between
 * them. Keeping the segments as chunks until save avoids re-copying the whole
 * accumulated buffer after every segment.
 */
export function mergePcm(chunks: Float32Array<ArrayBuffer>[]): Float32Array<ArrayBuffer> {
  const first = chunks[0]
  if (first === undefined) return new Float32Array(0)
  if (chunks.length === 1) return first
  const gap = Math.round(SEGMENT_GAP_S * TARGET_SAMPLE_RATE)
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + gap * (chunks.length - 1)
  const out = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length + gap
  }
  return out
}

/** Encode 16-bit PCM as a WAV blob. */
export function encodeWav(samples: Float32Array<ArrayBuffer>, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

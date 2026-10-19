import assert from 'node:assert/strict'
import test from 'node:test'
import { SEGMENT_GAP_S, TARGET_SAMPLE_RATE, encodeWav, mergePcm } from '../lib/client/audio.js'

test('mergePcm returns an empty track for no chunks', () => {
  assert.equal(mergePcm([]).length, 0)
})

test('mergePcm returns the single chunk unchanged (no copy)', () => {
  const chunk = new Float32Array([0.1, 0.2])
  assert.equal(mergePcm([chunk]), chunk)
})

test('mergePcm joins chunks with a silence gap', () => {
  const first = new Float32Array([1, 1])
  const second = new Float32Array([2, 2, 2])
  const merged = mergePcm([first, second])
  const gap = Math.round(SEGMENT_GAP_S * TARGET_SAMPLE_RATE)
  assert.equal(merged.length, first.length + gap + second.length)
  assert.equal(merged[0], 1)
  assert.equal(merged[first.length - 1], 1)
  assert.equal(merged[first.length], 0)
  assert.equal(merged[first.length + gap], 2)
})

test('encodeWav writes a 16 kHz mono 16-bit WAV header', async () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1])
  const blob = encodeWav(samples, TARGET_SAMPLE_RATE)
  assert.equal(blob.type, 'audio/wav')
  assert.equal(blob.size, 44 + samples.length * 2)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  assert.equal(String.fromCharCode(...bytes.subarray(0, 4)), 'RIFF')
  assert.equal(String.fromCharCode(...bytes.subarray(8, 12)), 'WAVE')
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), TARGET_SAMPLE_RATE)
  assert.equal(view.getUint16(34, true), 16)
  assert.equal(view.getUint32(40, true), samples.length * 2)
})

test('encodeWav clamps out-of-range samples', async () => {
  const blob = encodeWav(new Float32Array([2, -2]), TARGET_SAMPLE_RATE)
  const view = new DataView(await blob.arrayBuffer())
  assert.equal(view.getInt16(44, true), 0x7fff)
  assert.equal(view.getInt16(46, true), -0x8000)
})

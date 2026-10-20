/**
 * Browser-side preferences (localStorage). Missing or unreadable storage never
 * throws: the default ASR base stays in effect.
 */

import { ASR_BASE_STORAGE_KEY, DEFAULT_ASR_BASE, LEGACY_ASR_BASE_STORAGE_KEY } from '../config.ts'

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

/** Effective ASR base URL: the stored override, else the loopback default. */
export function readAsrBase(): string {
  const store = storage()
  if (store === undefined) return DEFAULT_ASR_BASE
  try {
    // 旧版本（改名前后）的 key 只读一次，读到就迁移到新 key，用户不用重设地址。
    const current = store.getItem(ASR_BASE_STORAGE_KEY)
    const legacy = current === null ? store.getItem(LEGACY_ASR_BASE_STORAGE_KEY) : null
    const raw = current ?? legacy
    const trimmed = raw?.trim() ?? ''
    if (trimmed !== '' && current === null && legacy !== null) {
      store.setItem(ASR_BASE_STORAGE_KEY, trimmed)
      store.removeItem(LEGACY_ASR_BASE_STORAGE_KEY)
    }
    return trimmed !== '' ? trimmed : DEFAULT_ASR_BASE
  } catch {
    return DEFAULT_ASR_BASE
  }
}

/** Persist the ASR base override; an empty value restores the default. */
export function writeAsrBase(value: string): void {
  const store = storage()
  if (store === undefined) return
  try {
    const trimmed = value.trim()
    if (trimmed === '') store.removeItem(ASR_BASE_STORAGE_KEY)
    else store.setItem(ASR_BASE_STORAGE_KEY, trimmed)
  } catch {
    /* storage full or blocked: keep the in-memory default */
  }
}

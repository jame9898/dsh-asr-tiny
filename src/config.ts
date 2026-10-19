/**
 * Shared configuration between the host half (Node) and the browser half.
 *
 * The local ASR service is the single external dependency. The host half can
 * be pointed at any compatible service through the plugin config; the browser
 * half defaults to loopback and lets users override it from the plugin's
 * settings card.
 */

/** Default local ASR service base URL. */
export const DEFAULT_ASR_BASE = 'http://127.0.0.1:8000'

/** localStorage key holding the browser-side ASR base override. */
export const ASR_BASE_STORAGE_KEY = 'dsh-plugin-asr-zh-tiny.asrBase'

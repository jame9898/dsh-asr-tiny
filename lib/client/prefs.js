/**
 * Browser-side preferences (localStorage). Missing or unreadable storage never
 * throws: the default ASR base stays in effect.
 */
import { ASR_BASE_STORAGE_KEY, DEFAULT_ASR_BASE } from "../config.js";
function storage() {
    try {
        return typeof window !== 'undefined' ? window.localStorage : undefined;
    }
    catch {
        return undefined;
    }
}
/** Effective ASR base URL: the stored override, else the loopback default. */
export function readAsrBase() {
    const store = storage();
    if (store === undefined)
        return DEFAULT_ASR_BASE;
    try {
        const raw = store.getItem(ASR_BASE_STORAGE_KEY);
        const trimmed = raw?.trim() ?? '';
        return trimmed !== '' ? trimmed : DEFAULT_ASR_BASE;
    }
    catch {
        return DEFAULT_ASR_BASE;
    }
}
/** Persist the ASR base override; an empty value restores the default. */
export function writeAsrBase(value) {
    const store = storage();
    if (store === undefined)
        return;
    try {
        const trimmed = value.trim();
        if (trimmed === '')
            store.removeItem(ASR_BASE_STORAGE_KEY);
        else
            store.setItem(ASR_BASE_STORAGE_KEY, trimmed);
    }
    catch {
        /* storage full or blocked: keep the in-memory default */
    }
}

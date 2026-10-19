/**
 * Browser-side preferences (localStorage). Missing or unreadable storage never
 * throws: the default ASR base stays in effect.
 */
/** Effective ASR base URL: the stored override, else the loopback default. */
export declare function readAsrBase(): string;
/** Persist the ASR base override; an empty value restores the default. */
export declare function writeAsrBase(value: string): void;

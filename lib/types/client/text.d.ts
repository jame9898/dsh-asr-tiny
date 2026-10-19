/**
 * CJK text helpers.
 *
 * Moonshine tokenizes CJK text character-by-character, so a Chinese utterance
 * can come back as "现 在 可 以 …". Dictation also has to be appended to the
 * composer draft without inventing spaces between ideographs, while Latin
 * words and digits keep their separating spaces.
 */
/** Collapse the inter-character spaces Moonshine inserts between CJK characters. */
export declare function normalizeAsrText(text: string): string;
/** Whether a single character belongs to the CJK set that never takes a joining space. */
export declare function isCjkChar(ch: string): boolean;
/**
 * Append one dictated segment to the existing draft instead of replacing it.
 * CJK text joins tightly (no inter-character spaces); anything involving Latin
 * letters or digits keeps a single separating space.
 */
export declare function joinDraft(existing: string, addition: string): string;

/**
 * CJK text helpers.
 *
 * Moonshine tokenizes CJK text character-by-character, so a Chinese utterance
 * can come back as "现 在 可 以 …". Dictation also has to be appended to the
 * composer draft without inventing spaces between ideographs, while Latin
 * words and digits keep their separating spaces.
 */
/** CJK ideographs, CJK punctuation and full-width forms: never space-separated. */
const CJK_RANGE = '\\u3000-\\u303f\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef';
const CJK_SPACE_RE = new RegExp(`([${CJK_RANGE}])\\s+(?=[${CJK_RANGE}])`, 'g');
const CJK_CHAR_RE = new RegExp(`[${CJK_RANGE}]`);
/** Collapse the inter-character spaces Moonshine inserts between CJK characters. */
export function normalizeAsrText(text) {
    return text.replace(CJK_SPACE_RE, '$1').trim();
}
/** Whether a single character belongs to the CJK set that never takes a joining space. */
export function isCjkChar(ch) {
    return CJK_CHAR_RE.test(ch);
}
/** Half-width punctuation between CJK characters -> full-width. */
const HALF_COMMA_RE = new RegExp(`(?<=[${CJK_RANGE}]),(?=[${CJK_RANGE}])`, 'g');
const HALF_DOT_RE = new RegExp(`(?<=[${CJK_RANGE}])\\.(?=[${CJK_RANGE}]|$)`, 'g');
const HALF_QUESTION_RE = new RegExp(`(?<=[${CJK_RANGE}])\\?(?=[${CJK_RANGE}]|$)`, 'g');
const HALF_BANG_RE = new RegExp(`(?<=[${CJK_RANGE}])!(?=[${CJK_RANGE}]|$)`, 'g');
/** Discourse markers that commonly start a new clause; a comma before them reads better. */
const DISCOURSE_RE = /(但是|然后|所以|因为|而且|不过|其实|另外|还有|就是|虽然|如果|比如)/;
const SENTENCE_END_RE = /[。！？!?…]/;
const QUESTION_END_RE = /[吗呢么]$/;
/**
 * Light punctuation cleanup for ASR output.
 *
 * Moonshine tiny output is often unpunctuated, or mixes half-width punctuation
 * into Chinese. This does three conservative things:
 *  - turn half-width `, . ? !` into full-width when they sit between CJK chars;
 *  - if a longer transcript has no punctuation at all, add one comma before a
 *    discourse marker (但是 / 然后 / 所以 …) so clauses do not run together;
 *  - guarantee a sentence-final mark (？ for 吗/呢/么, otherwise 。).
 *
 * It never rewrites words and never invents punctuation in short phrases.
 */
export function punctuateAsrText(text) {
    let out = text.trim();
    if (out === '')
        return out;
    out = out
        .replace(HALF_COMMA_RE, '，')
        .replace(HALF_DOT_RE, '。')
        .replace(HALF_QUESTION_RE, '？')
        .replace(HALF_BANG_RE, '！');
    if (out.length >= 12 && !SENTENCE_END_RE.test(out.replace(/，/g, ''))) {
        out = out.replace(DISCOURSE_RE, '，$1');
    }
    if (!SENTENCE_END_RE.test(out)) {
        out += QUESTION_END_RE.test(out) ? '？' : '。';
    }
    return out;
}
/**
 * Append one dictated segment to the existing draft instead of replacing it.
 * CJK text joins tightly (no inter-character spaces); anything involving Latin
 * letters or digits keeps a single separating space.
 */
export function joinDraft(existing, addition) {
    const head = existing.trimEnd();
    if (head === '')
        return addition;
    const tight = isCjkChar(head.charAt(head.length - 1)) && isCjkChar(addition.charAt(0));
    return tight ? head + addition : `${head} ${addition}`;
}

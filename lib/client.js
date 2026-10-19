window.__ModuleLoader__.load({
	id: "dsh-plugin-asr-zh-tiny",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/audio.ts
		/**
		* Browser audio helpers: decode a MediaRecorder blob into 16 kHz mono PCM,
		* merge dictated segments without repeated whole-buffer copies, and encode the
		* PCM the training pipeline expects.
		*/
		/** The training pipeline (finetune-moonshine-asr) strictly requires 16 kHz mono WAV. */
		const TARGET_SAMPLE_RATE = 16e3;
		/** Silence inserted between separately dictated segments so the merged sample stays intelligible. */
		const SEGMENT_GAP_S = .2;
		/** Decode a recorded blob into an AudioBuffer. No object URL is created, so nothing leaks. */
		function decodeAudio(blob) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(reader.error ?? /* @__PURE__ */ new Error("audio read failed"));
				reader.onload = () => {
					const ctx = new AudioContext();
					const close = () => {
						ctx.close().catch(() => {});
					};
					ctx.decodeAudioData(reader.result).then((buf) => {
						close();
						resolve(buf);
					}).catch((err) => {
						close();
						reject(err instanceof Error ? err : /* @__PURE__ */ new Error("audio decode failed"));
					});
				};
				reader.readAsArrayBuffer(blob);
			});
		}
		/** Average every channel into a single mono track (keeps voice, drops stereo offset). */
		function downmixToMono(buffer) {
			if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
			const length = buffer.length;
			const out = new Float32Array(length);
			for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
				const data = buffer.getChannelData(ch);
				for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) + data[i] / buffer.numberOfChannels;
			}
			return out;
		}
		/** Resample a mono track to the target rate (no-op when already matching). */
		async function resampleTo(samples, fromRate, toRate) {
			if (fromRate === toRate) return samples;
			const length = Math.max(1, Math.ceil(samples.length * toRate / fromRate));
			const offline = new OfflineAudioContext(1, length, toRate);
			const sourceBuffer = offline.createBuffer(1, samples.length, fromRate);
			sourceBuffer.copyToChannel(samples, 0);
			const source = offline.createBufferSource();
			source.buffer = sourceBuffer;
			source.connect(offline.destination);
			source.start();
			return (await offline.startRendering()).getChannelData(0).slice();
		}
		/** Decode a recorded blob into 16 kHz mono PCM (the training pipeline's format). */
		async function blobToPcm(blob) {
			const buffer = await decodeAudio(blob);
			return resampleTo(downmixToMono(buffer), buffer.sampleRate, TARGET_SAMPLE_RATE);
		}
		/**
		* Merge dictated segments into one track, inserting a short silence between
		* them. Keeping the segments as chunks until save avoids re-copying the whole
		* accumulated buffer after every segment.
		*/
		function mergePcm(chunks) {
			const first = chunks[0];
			if (first === void 0) return /* @__PURE__ */ new Float32Array(0);
			if (chunks.length === 1) return first;
			const gap = Math.round(SEGMENT_GAP_S * TARGET_SAMPLE_RATE);
			const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + gap * (chunks.length - 1);
			const out = new Float32Array(total);
			let offset = 0;
			for (const chunk of chunks) {
				out.set(chunk, offset);
				offset += chunk.length + gap;
			}
			return out;
		}
		/** Encode 16-bit PCM as a WAV blob. */
		function encodeWav(samples, sampleRate) {
			const buffer = /* @__PURE__ */ new ArrayBuffer(44 + samples.length * 2);
			const view = new DataView(buffer);
			const writeStr = (offset, s) => {
				for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
			};
			writeStr(0, "RIFF");
			view.setUint32(4, 36 + samples.length * 2, true);
			writeStr(8, "WAVE");
			writeStr(12, "fmt ");
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			view.setUint16(22, 1, true);
			view.setUint32(24, sampleRate, true);
			view.setUint32(28, sampleRate * 2, true);
			view.setUint16(32, 2, true);
			view.setUint16(34, 16, true);
			writeStr(36, "data");
			view.setUint32(40, samples.length * 2, true);
			let offset = 44;
			for (let i = 0; i < samples.length; i++) {
				const s = Math.max(-1, Math.min(1, samples[i]));
				view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
				offset += 2;
			}
			return new Blob([buffer], { type: "audio/wav" });
		}
		//#endregion
		//#region src/config.ts
		/**
		* Shared configuration between the host half (Node) and the browser half.
		*
		* The local ASR service is the single external dependency. The host half can
		* be pointed at any compatible service through the plugin config; the browser
		* half defaults to loopback and lets users override it from the plugin's
		* settings card.
		*/
		/** Default local ASR service base URL. */
		const DEFAULT_ASR_BASE = "http://127.0.0.1:8000";
		/** localStorage key holding the browser-side ASR base override. */
		const ASR_BASE_STORAGE_KEY = "dsh-plugin-asr-zh-tiny.asrBase";
		//#endregion
		//#region src/client/prefs.ts
		/**
		* Browser-side preferences (localStorage). Missing or unreadable storage never
		* throws: the default ASR base stays in effect.
		*/
		function storage() {
			try {
				return typeof window !== "undefined" ? window.localStorage : void 0;
			} catch {
				return;
			}
		}
		/** Effective ASR base URL: the stored override, else the loopback default. */
		function readAsrBase() {
			const store = storage();
			if (store === void 0) return DEFAULT_ASR_BASE;
			try {
				const trimmed = store.getItem("dsh-plugin-asr-zh-tiny.asrBase")?.trim() ?? "";
				return trimmed !== "" ? trimmed : DEFAULT_ASR_BASE;
			} catch {
				return DEFAULT_ASR_BASE;
			}
		}
		/** Persist the ASR base override; an empty value restores the default. */
		function writeAsrBase(value) {
			const store = storage();
			if (store === void 0) return;
			try {
				const trimmed = value.trim();
				if (trimmed === "") store.removeItem(ASR_BASE_STORAGE_KEY);
				else store.setItem(ASR_BASE_STORAGE_KEY, trimmed);
			} catch {}
		}
		//#endregion
		//#region src/client/text.ts
		/**
		* CJK text helpers.
		*
		* Moonshine tokenizes CJK text character-by-character, so a Chinese utterance
		* can come back as "现 在 可 以 …". Dictation also has to be appended to the
		* composer draft without inventing spaces between ideographs, while Latin
		* words and digits keep their separating spaces.
		*/
		/** CJK ideographs, CJK punctuation and full-width forms: never space-separated. */
		const CJK_RANGE = "\\u3000-\\u303f\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
		const CJK_SPACE_RE = new RegExp(`([${CJK_RANGE}])\\s+(?=[${CJK_RANGE}])`, "g");
		const CJK_CHAR_RE = new RegExp(`[${CJK_RANGE}]`);
		/** Collapse the inter-character spaces Moonshine inserts between CJK characters. */
		function normalizeAsrText(text) {
			return text.replace(CJK_SPACE_RE, "$1").trim();
		}
		/** Whether a single character belongs to the CJK set that never takes a joining space. */
		function isCjkChar(ch) {
			return CJK_CHAR_RE.test(ch);
		}
		/** Half-width punctuation between CJK characters -> full-width. */
		const HALF_COMMA_RE = new RegExp(`(?<=[${CJK_RANGE}]),(?=[${CJK_RANGE}])`, "g");
		const HALF_DOT_RE = new RegExp(`(?<=[${CJK_RANGE}])\\.(?=[${CJK_RANGE}]|$)`, "g");
		const HALF_QUESTION_RE = new RegExp(`(?<=[${CJK_RANGE}])\\?(?=[${CJK_RANGE}]|$)`, "g");
		const HALF_BANG_RE = new RegExp(`(?<=[${CJK_RANGE}])!(?=[${CJK_RANGE}]|$)`, "g");
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
		function punctuateAsrText(text) {
			let out = text.trim();
			if (out === "") return out;
			out = out.replace(HALF_COMMA_RE, "，").replace(HALF_DOT_RE, "。").replace(HALF_QUESTION_RE, "？").replace(HALF_BANG_RE, "！");
			if (out.length >= 12 && !SENTENCE_END_RE.test(out.replace(/，/g, ""))) out = out.replace(DISCOURSE_RE, "，$1");
			if (!SENTENCE_END_RE.test(out)) out += QUESTION_END_RE.test(out) ? "？" : "。";
			return out;
		}
		/**
		* Append one dictated segment to the existing draft instead of replacing it.
		* CJK text joins tightly (no inter-character spaces); anything involving Latin
		* letters or digits keeps a single separating space.
		*/
		function joinDraft(existing, addition) {
			const head = existing.trimEnd();
			if (head === "") return addition;
			return isCjkChar(head.charAt(head.length - 1)) && isCjkChar(addition.charAt(0)) ? head + addition : `${head} ${addition}`;
		}
		//#endregion
		//#region \0dsh-css:src/client/CollectorButton.module.css.mjs
		const css$1 = ".QtFKXW_wrap{flex-direction:column;align-items:center;display:inline-flex;position:relative}.QtFKXW_noticeOk,.QtFKXW_noticeError{white-space:pre-wrap;word-break:break-word;z-index:30;pointer-events:none;border-radius:8px;min-width:120px;max-width:340px;padding:6px 10px;font-size:12px;line-height:1.4;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translate(-50%);box-shadow:0 4px 16px #00000059}.QtFKXW_noticeOk{color:#7ee2a3;background:#14301c}.QtFKXW_noticeError{color:#ffb4b8;background:#3d1f21}.QtFKXW_pill{background:0 0;border:none;border-radius:0;align-items:center;gap:1px;padding:0;display:inline-flex}.QtFKXW_btn,.QtFKXW_btnActive,.QtFKXW_btnSaved{-webkit-appearance:none;-moz-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;width:28px;height:28px;color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer;box-shadow:none;user-select:none;background:0 0;border:none;border-radius:999px;justify-content:center;align-items:center;padding:0;transition:background-color .15s,color .15s,transform 80ms;display:inline-flex;outline-offset:0!important;outline:none!important}.QtFKXW_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#111827)}.QtFKXW_btn:active:not(:disabled),.QtFKXW_btnActive:active:not(:disabled),.QtFKXW_btnSaved:active:not(:disabled){transform:scale(.9)}.QtFKXW_btn:disabled,.QtFKXW_btnActive:disabled,.QtFKXW_btnSaved:disabled{opacity:.35;cursor:not-allowed}.QtFKXW_btn:focus,.QtFKXW_btnActive:focus,.QtFKXW_btnSaved:focus,.QtFKXW_btn:focus-visible,.QtFKXW_btnActive:focus-visible,.QtFKXW_btnSaved:focus-visible{box-shadow:none;outline:none!important}.QtFKXW_btn::-moz-focus-inner,.QtFKXW_btnActive::-moz-focus-inner,.QtFKXW_btnSaved::-moz-focus-inner{border:0;padding:0}.QtFKXW_btnActive{color:#fff;background:var(--dsw-alias-state-error-primary,#e5484d);animation:1.8s ease-out infinite QtFKXW_ripple}.QtFKXW_btnSaved{color:var(--dsw-alias-state-business-primary,#1a7f37);background:#1a7f371f}.QtFKXW_icon{width:16px;height:16px}.QtFKXW_eq{justify-content:center;align-items:center;gap:2px;width:16px;height:12px;display:inline-flex}.QtFKXW_eq i{background:currentColor;border-radius:1px;width:2px;height:100%;animation:.9s ease-in-out infinite QtFKXW_eq-bounce;display:block;transform:scaleY(.35)}.QtFKXW_eq i:nth-child(2){animation-delay:-.15s}.QtFKXW_eq i:nth-child(3){animation-delay:-.3s}.QtFKXW_dots{justify-content:center;align-items:center;gap:3px;width:16px;height:12px;display:inline-flex}.QtFKXW_dots i{opacity:.3;background:currentColor;border-radius:50%;width:4px;height:4px;animation:1s ease-in-out infinite QtFKXW_dot-pulse;display:block}.QtFKXW_dots i:nth-child(2){animation-delay:.15s}.QtFKXW_dots i:nth-child(3){animation-delay:.3s}.QtFKXW_btnTranscribing:disabled{opacity:1;cursor:progress;color:var(--dsw-alias-state-business-primary,#3b6fd4);background:#3b6fd424;animation:1.6s ease-in-out infinite QtFKXW_processing-glow}.QtFKXW_processing{color:#dbe4ff;white-space:nowrap;pointer-events:none;z-index:29;background:#161a24e0;border-radius:999px;align-items:center;gap:6px;padding:4px 10px;font-size:12px;line-height:1.4;animation:.16s ease-out QtFKXW_chip-in;display:inline-flex;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translate(-50%);box-shadow:0 4px 16px #00000047}@keyframes QtFKXW_eq-bounce{0%,to{transform:scaleY(.35)}50%{transform:scaleY(1)}}@keyframes QtFKXW_ripple{0%{box-shadow:0 0 #e5484d73}70%,to{box-shadow:0 0 0 6px #e5484d00}}@keyframes QtFKXW_dot-pulse{0%,to{opacity:.25;transform:scale(.75)}50%{opacity:1;transform:scale(1)}}@keyframes QtFKXW_processing-glow{0%,to{box-shadow:0 0 #3b6fd400}50%{box-shadow:0 0 0 4px #3b6fd41f}}@keyframes QtFKXW_chip-in{0%{opacity:0;transform:translate(-50%,4px)}to{opacity:1;transform:translate(-50%)}}";
		const tagId$1 = "dsh-plugin-asr-zh-tiny/CollectorButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-asr-zh-tiny";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var CollectorButton_module_css_default = {
			"ripple": "QtFKXW_ripple",
			"processing": "QtFKXW_processing",
			"wrap": "QtFKXW_wrap",
			"eq-bounce": "QtFKXW_eq-bounce",
			"dot-pulse": "QtFKXW_dot-pulse",
			"eq": "QtFKXW_eq",
			"btnActive": "QtFKXW_btnActive",
			"noticeError": "QtFKXW_noticeError",
			"btnSaved": "QtFKXW_btnSaved",
			"btn": "QtFKXW_btn",
			"processing-glow": "QtFKXW_processing-glow",
			"chip-in": "QtFKXW_chip-in",
			"noticeOk": "QtFKXW_noticeOk",
			"btnTranscribing": "QtFKXW_btnTranscribing",
			"icon": "QtFKXW_icon",
			"dots": "QtFKXW_dots",
			"pill": "QtFKXW_pill"
		};
		//#endregion
		//#region src/client/CollectorButton.tsx
		/** Upper bound for one ASR/save round-trip before the UI reports a timeout. */
		const REQUEST_TIMEOUT_MS = 3e4;
		/** The sample-count probe must never block the panel. */
		const COUNT_TIMEOUT_MS = 5e3;
		/** Whether the failure came from a request/response timeout rather than the service. */
		function isTimeoutError(error) {
			return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
		}
		function CollectorButton({ inputActions, useInput, t }) {
			const [phase, setPhase] = (0, react.useState)("idle");
			const [notice, setNotice] = (0, react.useState)(null);
			const [sampleCount, setSampleCount] = (0, react.useState)(0);
			const [hasClip, setHasClip] = (0, react.useState)(false);
			const draft = useInput((state) => state)?.draft ?? "";
			const draftRef = (0, react.useRef)(draft);
			(0, react.useEffect)(() => {
				draftRef.current = draft;
			}, [draft]);
			const mediaRef = (0, react.useRef)(null);
			const streamRef = (0, react.useRef)(null);
			const chunksRef = (0, react.useRef)([]);
			const busyRef = (0, react.useRef)(false);
			const lastClipRef = (0, react.useRef)(null);
			/** 上一次保存时输入框里的文本：保存后不清空草稿，下一次样本只取它之后新增的部分。 */
			const savedPrefixRef = (0, react.useRef)("");
			const noticeTimerRef = (0, react.useRef)(null);
			const flashNotice = (kind, text) => {
				if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
				setNotice({
					kind,
					text
				});
				noticeTimerRef.current = setTimeout(() => {
					setNotice(null);
					noticeTimerRef.current = null;
				}, 3e3);
			};
			/** Probe the current sample count; failures leave the panel usable. */
			const loadSampleCount = async () => {
				try {
					const response = await fetch(`${readAsrBase()}/samples`, { signal: AbortSignal.timeout(COUNT_TIMEOUT_MS) });
					if (!response.ok) return;
					const body = await response.json();
					setSampleCount(typeof body.count === "number" ? body.count : 0);
				} catch {}
			};
			(0, react.useEffect)(() => {
				loadSampleCount();
			}, []);
			(0, react.useEffect)(() => () => {
				if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
				if (mediaRef.current && mediaRef.current.state === "recording") mediaRef.current.stop();
				streamRef.current?.getTracks().forEach((tr) => tr.stop());
			}, []);
			const finalizeRecording = async (mimeType) => {
				if (busyRef.current) return;
				busyRef.current = true;
				let stage = "decode";
				try {
					setPhase("transcribing");
					const recorded = new Blob(chunksRef.current, { type: mimeType });
					chunksRef.current = [];
					const samples = await blobToPcm(recorded);
					stage = "request";
					const form = new FormData();
					form.append("file", encodeWav(samples, TARGET_SAMPLE_RATE), "clip.wav");
					const resp = await fetch(`${readAsrBase()}/transcribe`, {
						method: "POST",
						body: form,
						signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
					});
					if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
					const json = await resp.json();
					const hypothesis = normalizeAsrText(typeof json.text === "string" ? json.text : "");
					const text = punctuateAsrText(hypothesis);
					if (text !== "") {
						const prev = lastClipRef.current;
						lastClipRef.current = {
							chunks: [...prev?.chunks ?? [], samples],
							asrParts: [...prev?.asrParts ?? [], hypothesis]
						};
						setHasClip(true);
						inputActions.setDraft(joinDraft(draftRef.current, text));
					} else flashNotice("error", t("noSpeech"));
					setPhase("idle");
				} catch (error) {
					flashNotice("error", t(isTimeoutError(error) ? "timeout" : stage === "decode" ? "decodeFailed" : "transcribeFailed"));
					setPhase("idle");
				} finally {
					busyRef.current = false;
				}
			};
			const startRecording = async () => {
				let stream;
				try {
					stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				} catch {
					flashNotice("error", t("micDenied"));
					return;
				}
				try {
					const recorder = new MediaRecorder(stream);
					chunksRef.current = [];
					recorder.ondataavailable = (e) => {
						if (e.data.size > 0) chunksRef.current.push(e.data);
					};
					recorder.onstop = () => {
						const mimeType = recorder.mimeType || "audio/webm";
						stream.getTracks().forEach((tr) => tr.stop());
						if (streamRef.current === stream) streamRef.current = null;
						finalizeRecording(mimeType);
					};
					mediaRef.current = recorder;
					streamRef.current = stream;
					recorder.start();
				} catch {
					stream.getTracks().forEach((tr) => tr.stop());
					mediaRef.current = null;
					streamRef.current = null;
					flashNotice("error", t("recorderFailed"));
					return;
				}
				setPhase("recording");
			};
			const stopRecording = () => {
				if (mediaRef.current && mediaRef.current.state === "recording") mediaRef.current.stop();
			};
			const clearInput = () => {
				inputActions.setDraft("");
				lastClipRef.current = null;
				savedPrefixRef.current = "";
				setHasClip(false);
			};
			const saveSample = async () => {
				const clip = lastClipRef.current;
				if (!clip || busyRef.current) return;
				const asrHyp = clip.asrParts.reduce((acc, part) => joinDraft(acc, part), "");
				const draftRaw = draftRef.current;
				const prefix = savedPrefixRef.current;
				const text = (prefix !== "" && draftRaw.startsWith(prefix) ? draftRaw.slice(prefix.length).trim() : draftRaw.trim()) || asrHyp.trim();
				if (!text) {
					flashNotice("error", t("noSpeech"));
					return;
				}
				busyRef.current = true;
				setPhase("saving");
				try {
					const merged = mergePcm(clip.chunks);
					const form = new FormData();
					form.append("text", text);
					form.append("asr_hyp", asrHyp);
					form.append("duration_s", String(merged.length / TARGET_SAMPLE_RATE));
					form.append("file", encodeWav(merged, TARGET_SAMPLE_RATE), "clip.wav");
					const resp = await fetch(`${readAsrBase()}/samples`, {
						method: "POST",
						body: form,
						signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
					});
					if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
					if ((await resp.json()).ok) {
						lastClipRef.current = null;
						savedPrefixRef.current = draftRaw;
						setHasClip(false);
						loadSampleCount();
						flashNotice("ok", t("saved"));
					} else flashNotice("error", t("saveFailed"));
				} catch (error) {
					flashNotice("error", t(isTimeoutError(error) ? "timeout" : "saveFailed"));
				} finally {
					busyRef.current = false;
					setPhase("idle");
				}
			};
			const recording = phase === "recording";
			const transcribing = phase === "transcribing";
			const saving = phase === "saving";
			const busy = transcribing || saving;
			const canSave = phase === "idle" && hasClip;
			const hasDraft = draft.length > 0;
			const micTitle = recording ? t("stop") : t("record");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CollectorButton_module_css_default.wrap,
				children: [
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: notice.kind === "error" ? CollectorButton_module_css_default.noticeError : CollectorButton_module_css_default.noticeOk,
						role: notice.kind === "error" ? "alert" : "status",
						children: notice.text
					}),
					busy && notice === null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CollectorButton_module_css_default.processing,
						role: "status",
						"aria-live": "polite",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: CollectorButton_module_css_default.dots,
							"aria-hidden": "true",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
							]
						}), transcribing ? t("recognizing") : t("saving")]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CollectorButton_module_css_default.pill,
						role: "group",
						"aria-label": t("title"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: transcribing ? `${CollectorButton_module_css_default.btn} ${CollectorButton_module_css_default.btnTranscribing}` : recording ? CollectorButton_module_css_default.btnActive : CollectorButton_module_css_default.btn,
								"aria-label": micTitle,
								"aria-pressed": recording,
								title: micTitle,
								disabled: busy,
								onClick: () => {
									if (recording) stopRecording();
									else startRecording();
								},
								children: transcribing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: CollectorButton_module_css_default.dots,
									"aria-hidden": "true",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
									]
								}) : recording ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: CollectorButton_module_css_default.eq,
									"aria-hidden": "true",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
									]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									className: CollectorButton_module_css_default.icon,
									viewBox: "0 0 24 24",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										fill: "currentColor",
										d: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-2.06A8 8 0 0 0 20 12h-2Z"
									})
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: CollectorButton_module_css_default.btn,
								"aria-label": t("clear"),
								title: t("clear"),
								disabled: !hasDraft,
								onClick: clearInput,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									className: CollectorButton_module_css_default.icon,
									viewBox: "0 0 24 24",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										fill: "currentColor",
										d: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"
									})
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: notice?.kind === "ok" ? CollectorButton_module_css_default.btnSaved : CollectorButton_module_css_default.btn,
								"aria-label": t("save"),
								title: `${t("save")} (${t("collected")} ${sampleCount})`,
								disabled: !canSave,
								onClick: () => {
									saveSample();
								},
								children: saving ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: CollectorButton_module_css_default.dots,
									"aria-hidden": "true",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
									]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									className: CollectorButton_module_css_default.icon,
									viewBox: "0 0 24 24",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										fill: "currentColor",
										d: "M5 4a1 1 0 0 1 1-1h10l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4Zm4 0v4h5V4H9Zm-2 7v6h10v-6H7Zm2-2h6v2H9V9Z"
									})
								})
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/SettingsCard.module.css.mjs
		const css = ".cnmE2G_card{flex-direction:column;gap:6px;padding:8px 0;display:flex}.cnmE2G_label{color:var(--dsw-alias-label-primary,#111827);font-size:13px}.cnmE2G_row{align-items:center;gap:8px;display:flex}.cnmE2G_input{border:1px solid var(--dsw-alias-border-l2,#0000001f);background:var(--dsw-alias-bg-base,#fff);min-width:0;color:var(--dsw-alias-label-primary,#111827);border-radius:8px;outline:none;flex:1;padding:6px 10px;font-size:13px}.cnmE2G_input:focus{border-color:var(--dsw-alias-border-l1,#00000047)}.cnmE2G_save{cursor:pointer;color:#fff;background:var(--dsw-alias-button-info-fill,#2563eb);border:none;border-radius:8px;padding:6px 12px;font-size:13px}.cnmE2G_hint{color:var(--dsw-alias-label-tertiary,#6b7280);margin:0;font-size:12px}";
		const tagId = "dsh-plugin-asr-zh-tiny/SettingsCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-asr-zh-tiny";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SettingsCard_module_css_default = {
			"input": "cnmE2G_input",
			"save": "cnmE2G_save",
			"hint": "cnmE2G_hint",
			"label": "cnmE2G_label",
			"row": "cnmE2G_row",
			"card": "cnmE2G_card"
		};
		//#endregion
		//#region src/client/SettingsCard.tsx
		/** Plugin settings card: where the browser half reaches the local ASR service. */
		function SettingsCard({ t }) {
			const [value, setValue] = (0, react.useState)(readAsrBase());
			const [saved, setSaved] = (0, react.useState)(false);
			const save = () => {
				writeAsrBase(value);
				setValue(readAsrBase());
				setSaved(true);
				setTimeout(() => setSaved(false), 1500);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SettingsCard_module_css_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						className: SettingsCard_module_css_default.label,
						htmlFor: "dsh-plugin-asr-zh-tiny-asr-base",
						children: t("settingsAsrBase")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SettingsCard_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: "dsh-plugin-asr-zh-tiny-asr-base",
							className: SettingsCard_module_css_default.input,
							value,
							placeholder: DEFAULT_ASR_BASE,
							spellCheck: false,
							onChange: (event) => setValue(event.target.value)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SettingsCard_module_css_default.save,
							onClick: save,
							children: t("settingsSave")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SettingsCard_module_css_default.hint,
						children: saved ? t("settingsSaved") : t("settingsHint")
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			title: "语音采集（Moonshine）",
			record: "开始录音",
			stop: "停止并识别",
			clear: "清空输入与录音",
			saved: "已保存样本",
			collected: "已采集",
			recognizing: "识别中",
			saving: "保存中",
			save: "保存样本",
			micDenied: "无法访问麦克风，请检查麦克风权限",
			recorderFailed: "无法启动录音，请检查麦克风设备",
			noSpeech: "未识别到语音，请重试",
			decodeFailed: "音频解码失败，请重试",
			transcribeFailed: "识别失败，请确认本地 ASR 服务已启动",
			saveFailed: "保存失败，请确认本地 ASR 服务已启动",
			timeout: "请求超时，本地 ASR 服务无响应",
			settingsAsrBase: "本地 ASR 服务地址",
			settingsSave: "保存",
			settingsSaved: "已保存，重新录音即生效",
			settingsHint: "默认 http://127.0.0.1:8000；留空恢复默认"
		};
		const en = {
			title: "Voice Collector (Moonshine)",
			record: "Start Recording",
			stop: "Stop & Recognize",
			clear: "Clear input & recording",
			saved: "Saved sample",
			collected: "Collected",
			recognizing: "Recognizing",
			saving: "Saving",
			save: "Save sample",
			micDenied: "Microphone unavailable — check microphone permission",
			recorderFailed: "Recorder could not start — check the microphone device",
			noSpeech: "No speech detected — please try again",
			decodeFailed: "Audio decode failed — please try again",
			transcribeFailed: "Recognition failed — is the local ASR service running?",
			saveFailed: "Save failed — is the local ASR service running?",
			timeout: "Request timed out — the local ASR service is not responding",
			settingsAsrBase: "Local ASR service URL",
			settingsSave: "Save",
			settingsSaved: "Saved — applies to the next recording",
			settingsHint: "Defaults to http://127.0.0.1:8000; leave empty to reset"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-plugin-asr-zh-tiny-client";
		const inject = ["slots", "locale"];
		const LOCALE_NS = "voice.collector";
		/** The bundle this package's client half belongs to (plugin-manager settings key). */
		const BUNDLE_NAME = "dsh-plugin-asr-zh-tiny";
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NS, {
				zh,
				en
			}), "dsh-plugin-asr-zh-tiny: dictionaries");
			ctx.effect(() => {
				return ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
					name: "conversation.input.left",
					id: "voice-collector-panel",
					order: 20,
					locale: LOCALE_NS,
					inject: () => ({})
				}, CollectorButton));
			}, "dsh-plugin-asr-zh-tiny: collector slot");
			ctx.effect(() => {
				return ctx.slots.inject("plugins.bundle.config", () => {
					const options = {
						name: "plugins.bundle.config",
						key: BUNDLE_NAME,
						locale: LOCALE_NS,
						inject: () => ({})
					};
					return ctx.slots.register(options, SettingsCard);
				});
			}, "dsh-plugin-asr-zh-tiny: settings card");
		}
		//#endregion
		exports.BUNDLE_NAME = BUNDLE_NAME;
		exports.LOCALE_NS = LOCALE_NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
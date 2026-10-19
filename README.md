# dsh-plugin-asr-zh-tiny

[![DSH](https://img.shields.io/badge/DSH-%3C%3D0.2.1--rc.2-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

English | [中文](./README.zh.md)

A small Chinese speech recognition plugin for the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) desktop client.
It serves two purposes: turning what you say into text, and saving recordings with corrected
transcripts as training samples for fine-tuning your own speech model.

- Works with the **DSH desktop client (0.2.x)**.
- Audio and text never leave the machine: the plugin only talks to a local ASR service.
- The plugin ships both halves: the client bundle (composer tool row + settings card)
  and an optional host half that can bind the ASR service to the DSH lifecycle.

> **This plugin bundles no ASR engine.** It drives a local ASR service. If you do not have one
> yet, start with the runnable reference in [`examples/asr-service`](./examples/asr-service/README.md)
> (`pip install -r requirements.txt && python server.py`).

## Features

- **Composer capsule**: three compact buttons (🎤 record, ✕ clear, 💾 save) that match the
  native 28 px composer controls.
- **Continuous dictation**: every transcript is *appended* to the draft (CJK joins tightly,
  Latin words and digits keep a single space).
- **Multi-segment samples**: segments recorded before a save are merged into one sample,
  with a 0.2 s silence between them, so text and audio always describe the same utterance.
- **Editable transcript**: save the corrected text together with the raw ASR hypothesis.
- **Recording feedback**: the mic turns red with a breathing ripple and three bouncing
  level bars; recognition and save show an inline spinner; failures show a red notice
  (microphone denied, recorder unavailable, service offline, no speech, decode failure, timeout).
- **Bilingual UI** (Chinese / English) and a settings card for the ASR service URL.

## Requirements

- DSH `<=0.2.1-rc.2` — desktop client 0.2.x.
- Node.js `^22.19.0 || >=24.0.0`.
- A local ASR service implementing the HTTP contract below, by default at
  `http://127.0.0.1:8000`.

### ASR service contract

| Endpoint | Request | Response |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file` (16 kHz mono WAV) | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`, `asr_hyp`, `duration_s` + `file` | `{"ok": true, "id": "..."}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok"}` |

Any server implementing these endpoints works. The reference implementation used while
developing this plugin is a FastAPI + Moonshine (`moonshine-tiny-zh`) service that stores
samples under a local `data/` directory.

### Where the model comes from

This plugin ships **no model**: the ASR service owns it. The reference Moonshine service uses:

| Model | Language | Params | Notes |
| :--- | :--- | ---: | :--- |
| [`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) | Chinese | 27 M | `model.safetensors` ≈ 103 MB; license is the model card's own (`other`) |
| [`moonshine-ai/moonshine-tiny`](https://huggingface.co/moonshine-ai/moonshine-tiny) | English | 27 M | MIT |
| [`moonshine-ai/moonshine-base`](https://huggingface.co/moonshine-ai/moonshine-base) | English | 61 M | MIT |

Download once (either CLI form works):

```sh
huggingface-cli download moonshine-ai/moonshine-tiny-zh --local-dir models/moonshine-tiny-zh
# newer CLIs: hf download moonshine-ai/moonshine-tiny-zh --local-dir models/moonshine-tiny-zh
# mainland China mirror: HF_ENDPOINT=https://hf-mirror.com huggingface-cli download ...
```

…or load straight from the hub in Python:

```python
from transformers import AutoProcessor, MoonshineForConditionalGeneration
processor = AutoProcessor.from_pretrained("moonshine-ai/moonshine-tiny-zh")
model = MoonshineForConditionalGeneration.from_pretrained("moonshine-ai/moonshine-tiny-zh")
```

Optional: export to ONNX (`encoder_model.onnx` + `decoder_model.onnx`) for faster startup.
The reference service prefers ONNX when present and falls back to the PyTorch weights.

### Where saved samples go

The plugin **never writes files**. Every sample is `POST`ed to the ASR service's `/samples`
endpoint, so storage is entirely the service's concern. The reference service writes, under
its own working directory:

```
data/
  audio/{id}.wav       # 16 kHz mono WAV, one file per sample
  metadata.csv         # id, wav_path, text, asr_hyp, created_at, duration_s
```

The plugin only reads `GET /samples` for the saved-count badge; where the audio lands is up to
your service.

## Install

The plugin is an out-of-tree client bundle (`dsh.client` + `dsh.bundle.patch`).
`lib/` is committed, so a git install needs no build step.

### Desktop client (DSH 0.2.x)

The desktop client uses its own profile directory (`~/.dsh/profiles/desktop` on Windows):

1. Add the dependency to the profile's `package.json`:
   `"dsh-plugin-asr-zh-tiny": "file:<path-to-checkout>"` (or `"github:<owner>/dsh-plugin-asr-zh-tiny"`).
2. Add `"dsh-plugin-asr-zh-tiny"` to `dsh.profile.bundles`.
3. Install with the client's bundled runtime (skip lifecycle scripts; `lib/` is already built):

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

Restart the client to load the profile; afterwards the plugin loads on every start. Client
bundles are polled for changes, so rebuilding + reinstalling usually hot-reloads without a restart.

> DSH 0.2 validates a plugin's `peerDependencies` ranges (optional peers included). This plugin
> declares `<=0.2.1-rc.2` for the DSH client packages — up to the current release.
> When DSH ships a newer version, widen the upper bound and reinstall; otherwise the plugin page
> marks it incompatible and refuses to load it.

### Quick start (desktop client, copy-paste)

Target file: `%USERPROFILE%\.dsh\profiles\desktop\package.json` on Windows
(`~/.dsh/profiles/desktop/package.json` elsewhere). Keep the entries already there:

```json
{
  "dependencies": {
    "dsh-plugin-asr-zh-tiny": "file:E:/path/to/dsh-plugin-asr-zh-tiny"
  },
  "dsh": {
    "profile": {
      "bundles": ["…existing bundles…", "dsh-plugin-asr-zh-tiny"]
    }
  }
}
```

Then install with the client's bundled runtime and restart the client:

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

### Install with an AI agent

The repository is self-contained: `lib/` is committed, so an install needs **no build step**.
Hand an agent this checklist:

1. **Locate the profile.** `%USERPROFILE%\.dsh\profiles\desktop` (Windows) or
   `~/.dsh/profiles/desktop`.
2. **Register the plugin.** Add the dependency and bundle entries shown above.
3. **Install.** Run the bundled-runtime `pnpm install --ignore-scripts` command above.
4. **Restart** the client so the profile is reloaded.
5. **Verify** with the checklist below.
6. **Optionally** enable host auto-start in `cordis.patch.yml` (see Configuration).

## Verify the installation

- The plugin page (插件 → `dsh-plugin-asr-zh-tiny`) lists the bundle **without** an error badge.
- The composer tool row shows the capsule (🎤 ✕ 💾).
- The plugin page shows the ASR URL settings card.
- `curl http://127.0.0.1:8000/health` answers `{"status":"ok", ...}`; a recording then produces text.

## Troubleshooting

| Symptom | Cause / fix |
| :--- | :--- |
| Plugin marked **incompatible / 异常** | The DSH version is outside the declared peer ranges (`<=0.2.1-rc.2`). Widen them and reinstall. |
| No capsule in the composer | The profile was not reloaded: restart the client, and check `dsh.profile.bundles` contains `dsh-plugin-asr-zh-tiny`. |
| Red notice “识别失败… / is the local ASR service running?” | `/health` is not answering. Start the service (see [`examples/asr-service`](./examples/asr-service/README.md)). |
| Recording works but requests time out | The service is hung, or the settings card points at the wrong URL. |
| A console window stays open | The service was started with `python.exe`; use `pythonw.exe` (see the host config). |
| `pnpm` blocks build scripts | The plugin needs no build (`lib/` is committed); install with `--ignore-scripts`. |

## Configuration

### Client half — ASR service URL

Open the plugin page (插件 → `dsh-plugin-asr-zh-tiny`) and edit **本地 ASR 服务地址**
in the settings card. The value is stored in `localStorage` under
`dsh-plugin-asr-zh-tiny.asrBase`; leaving it empty restores the default
`http://127.0.0.1:8000`.

### Host half — optional service lifecycle (opt-in)

By default the host half only registers the plugin. It can also start the ASR service with
DSH and stop the process it started itself. Add to the profile's `cordis.patch.yml`:

```yaml
- id: dsh-plugin-asr-zh-tiny
  name: dsh-plugin-asr-zh-tiny
  config:
    asrBase: 'http://127.0.0.1:8000'       # optional, this is the default
    autoStart: true                        # default false
    pythonPath: 'C:\path\to\moonshine\venv\Scripts\pythonw.exe'
    serverPath: 'C:\path\to\moonshine\asr\server.py'
    logDir: 'C:\path\to\moonshine\asr'     # optional rotating logs
```

- The service is adopted only when the port is idle; an already-running service is left alone.
- On unload, only the process this plugin started is stopped (graceful `taskkill /T`, then
  forced after a short wait). This lifecycle is Windows-only; other platforms fall back to a
  plain signal.
- Prefer `pythonw.exe`: `python.exe` started detached makes the venv redirector give the real
  server a brand-new **visible** console window.

## Usage

1. The capsule appears in the composer tool row.
2. Click 🎤 to record, click again to stop — the transcript is appended to the draft.
3. Keep dictating to extend the draft, or fix typos first.
4. Click 💾 to save: the accumulated audio plus the current draft text become one sample.
   - **The draft is not cleared** — you can keep editing or send it.
   - Dictation after a save only contributes the newly added text to the next sample.
5. Click ✕ to clear the draft and discard the unsaved audio.

## Development

```sh
pnpm install
pnpm run build        # clean lib/ -> tsc (host half + types) -> tsdown (client bundle)
pnpm run typecheck
pnpm test             # build + node --test (pure helpers: text joining, PCM merge, WAV encoding)
```

- `src/index.ts` — host half: plugin-tree registration and the opt-in ASR service lifecycle.
- `src/client/` — client half: slot registrations (composer capsule + settings card).
- `src/client/text.ts`, `src/client/audio.ts` — pure helpers covered by `tests/`.
- `src/config.ts` — shared defaults (`DEFAULT_ASR_BASE`, storage key).
- CSS Modules compile into the client bundle via `tsdown.config.ts`.

## 中文说明

完整简体中文文档见 **[README.zh.md](./README.zh.md)**。

输入框工具行里的语音采集插件：点 🎤 录音 → 本地 ASR 识别 → 文字**追加**到输入框 → 可改字 →
点 💾 保存为一条训练样本（16 kHz 单声道 WAV + 校正文本）。保存**不会清空**输入框文字；
连续听写时，已保存过的部分不会重复计入下一条样本。识别与保存都只访问本机 ASR 服务
（默认 `http://127.0.0.1:8000`，可在插件页设置）。可选：在 profile 的 `cordis.patch.yml`
里配置 `autoStart` 等字段，让 DSH 启动时自动拉起本地服务、退出时回收。

## License

The plugin code is MIT (see [`LICENSE`](./LICENSE)).

This repository ships **no model weights and no training data**. The reference service loads
[`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh),
which is distributed under the **Moonshine AI Community License**; review that agreement before
using or redistributing the model.

# dsh-asr-tiny

[![DSH](https://img.shields.io/badge/DSH-%3C%3D0.2.1--rc.2-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A small Chinese speech recognition plugin for the DeepSeek Harness desktop client.
Press 🎤, speak, and the text lands in the composer; correct it and save — the recording becomes
a training sample for your own voice model.

## 30-second start

1. **Start the local ASR service** — `<workspace>\scripts\restart_asr.ps1` (or double-click
   `start_asr.vbs`). `{"status":"ok", ...}` means it is up.
2. **Install the plugin** — see [Install](#install), then restart the client.
3. **Talk** — the 🎤 ✕ 💾 capsule appears in the composer tool row; press 🎤.

## Daily use

| Button | What it does | Details |
| :--- | :--- | :--- |
| 🎤 | Press to record, press again to stop and transcribe | Text is **appended** to the draft; it never overwrites what you already typed |
| ✕ | Clear the composer and any unsaved recording | Saved samples are untouched |
| 💾 | Save "accumulated audio + current text" as one sample | **Does not clear the draft** — keep editing, keep sending |

Behaviors you only notice after using it for a while:

- **Continuous dictation** — speak, pause, speak again; the text keeps growing. Chinese joins
  tightly, Latin words and digits keep one space.
- **Saving does not reset the draft** — the next sample only takes text added after the previous
  save, so the same sentence never lands in two samples.
- **Punctuation** — the model does not always punctuate. The plugin appends `。`/`？` at the end and
  inserts commas before 但是 / 然后 / 所以 / 因为 …; fix anything it gets wrong.
- **While recording** the button turns red with a waveform; while recognizing, a “识别中 / Recognizing”
  chip with pulsing dots appears, and text usually lands within a second.
- **The draft is never lost** by dictation or saving — only ✕ clears it.

## Where samples go

The local ASR service writes them (the plugin itself writes no files):

```
data\audio\{id}.wav       16 kHz mono WAV
data\metadata.csv         id, wav_path, text, asr_hyp, created_at, duration_s
```

- `text` — your corrected transcript, the training label
- `asr_hyp` — the raw model output, for comparison
- training only needs the `file, text` columns

## FAQ

| Symptom | Cause / fix |
| :--- | :--- |
| 🎤 does nothing | Microphone permission denied (notice says “无法访问麦克风”); allow it in system settings |
| “识别失败 / 超时” | The local service is down: `curl http://127.0.0.1:8000/health`, restart it if needed |
| “识别中” never finishes | Service not responding, or the URL in the settings card is wrong |
| Transcript has no punctuation | Model limitation; the plugin only appends final marks and clause commas |
| New ASR URL not used | It takes effect on the **next** recording after saving |
| Still the old version after upgrading | A stale copy lives in the profile: run `scripts\upgrade.ps1`, or delete `node_modules\dsh-asr-tiny` first |

## Install

### Desktop client (DSH 0.2.x)

1. Register it in the profile's `package.json` (keep existing entries):

```json
{
  "dependencies": { "dsh-asr-tiny": "file:E:/path/to/dsh-asr-tiny" },
  "dsh": { "profile": { "bundles": ["…existing bundles…", "dsh-asr-tiny"] } }
}
```

2. Install with the client's bundled runtime:

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

3. Restart the client.

### Give it to an AI agent

Hand an agent this repo and this list:

1. Check `curl http://127.0.0.1:8000/health`; start the service first if it is down
2. Add the dependency and bundle entry to `%USERPROFILE%\.dsh\profiles\desktop\package.json`
3. **If an older copy is installed**, delete `node_modules\dsh-asr-tiny` first, then run the pnpm
   command above (pnpm caches `file:` installs)
4. Restart the client
5. Verify: plugin page has no error badge, the capsule shows up, one recording produces text

### Upgrade

The profile copies the plugin into its own `node_modules` and pnpm caches `file:` installs, so
**running install alone does not upgrade**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\upgrade.ps1
# then restart the client; the plugin page shows the new version
```

## Configuration

- **ASR URL** — plugin page → settings card; default `http://127.0.0.1:8000`, stored in
  `localStorage` (kept across upgrades; the old `dsh-plugin-asr-zh-tiny` key is migrated once)
- **Auto-start the service with the client** (optional) — profile `cordis.patch.yml`:

```yaml
- id: dsh-asr-tiny
  name: dsh-asr-tiny
  config:
    autoStart: true
    pythonPath: 'C:\path\to\moonshine\venv\Scripts\pythonw.exe'
    serverPath: 'C:\path\to\moonshine\asr\server.py'
    logDir: 'C:\path\to\moonshine\asr'
```

## What ASR service do I need?

The plugin only captures audio and renders UI; recognition happens locally:

| Endpoint | Request | Response |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file` (16 kHz mono WAV) | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`, `asr_hyp`, `duration_s` + `file` | `{"ok": true, "id": "..."}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok"}` |

Any server implementing these works. `examples/asr-service` ships a runnable reference:

```sh
cd examples/asr-service
pip install -r requirements.txt
python server.py
```

## Development

```sh
pnpm install
pnpm run build        # tsc (host half + types) then tsdown (client bundle)
pnpm run typecheck
pnpm test             # 15 unit tests: punctuation/joining, PCM merge, WAV encoding
```

- `src/index.ts` — host half: registers the plugin, optionally supervises the ASR process
- `src/client/` — client half: composer capsule + settings card
- `src/client/text.ts` — space normalization, punctuation, draft joining (covered by `tests/`)
- `src/client/audio.ts` — decode, resample to 16 kHz, WAV encoding

## License

Plugin code is MIT (see [`LICENSE`](./LICENSE)). This repository contains no model weights and no
training data; the reference service loads
[`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) at runtime,
which is distributed under the Moonshine AI Community License.

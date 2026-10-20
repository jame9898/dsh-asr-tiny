# dsh-asr-tiny

[![version](https://img.shields.io/badge/version-0.0.1-5b8def)](https://github.com/jame9898/dsh-asr-tiny)
[![DSH](https://img.shields.io/badge/DSH-%3C%3D0.2.1--rc.2-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

English | [中文](./README.zh.md)

Speak into DeepSeek Harness — the text appears in the composer.

Say it, fix a word or two, and send.
If you want to keep it as training data, press save: the recording and its text are
stored, so you can fine-tune your own voice model later.

Recognition runs on your own machine; audio and text are never uploaded.

![Idle, recording, recognizing and saved states](docs/assets/capsule.gif)

## Install

Give the repo URL to an AI agent: have it clone, read the files, then install.

#### 1. Clone the repo

```sh
git clone https://github.com/jame9898/dsh-asr-tiny.git
```

#### 2. Files

| File / directory | Purpose |
| :--- | :--- |
| `package.json` | Plugin manifest: name, version, client entry (`dsh.client`) |
| `cordis.patch.yml` | Mounts the plugin into DSH's plugin tree |
| `src/index.ts` | Host half: registers the plugin, can supervise the recognition process |
| `src/client/` | UI half: composer buttons, settings card, audio and text handling |
| `lib/` | Built plugin bundle (committed — no build needed) |
| `examples/asr-service/` | Reference recognition service (FastAPI + Moonshine), optional |
| `scripts/upgrade.ps1` | Upgrades an already installed copy |
| `tests/` | Unit tests |

#### 3. Prepare a recognition service

If you do not have one, use `examples/asr-service` (CPU or GPU — that README covers both in detail).

#### 4. Register the plugin and install

Add this to the profile's `package.json` (keep what is already there):

```json
{
  "dependencies": { "dsh-asr-tiny": "file:<cloned directory>" },
  "dsh": { "profile": { "bundles": ["…existing bundles…", "dsh-asr-tiny"] } }
}
```

Install it with the Node and pnpm that ship inside the DSH install directory (not the system pnpm):

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

> If an older version is installed, delete `node_modules\dsh-asr-tiny` first — otherwise the old
> one keeps loading.

#### 5. Restart the client

Once the 🎤 ✕ 💾 buttons appear next to the composer, it is installed.

The first recognition downloads the Chinese model (about 100 MB). On a slow connection in mainland
China, set the mirror first: `set HF_ENDPOINT=https://hf-mirror.com`.

## Data

The recognition service stores everything in its own `data` directory:

- `audio/*.wav` — the recordings
- `metadata.csv` — the text and what it belongs to

The plugin stores no files, so uninstalling it never loses your data.

## ASR models

The plugin ships no model; the recognition service picks one of these at startup:

| Model | Language | Notes |
| :--- | :--- | :--- |
| `moonshine-ai/moonshine-tiny-zh` | Chinese | Tested |
| `moonshine-ai/moonshine-tiny` | English | Same architecture, **untested** |
| `moonshine-ai/moonshine-base` | English | **Untested** |

**This repository contains no model files.** Download the one you need from Hugging Face:

- Chinese: https://huggingface.co/moonshine-ai/moonshine-tiny-zh
- English: https://huggingface.co/moonshine-ai/moonshine-tiny
- English (larger): https://huggingface.co/moonshine-ai/moonshine-base

In mainland China, the mirror works by swapping the host for `hf-mirror.com`, for example
https://hf-mirror.com/moonshine-ai/moonshine-tiny-zh .

No manual wiring is needed: on first start the service uses the model named by `MOONSHINE_MODEL`
(a Hugging Face id or a local directory); the Chinese one is the default.

License: the Chinese model follows the Moonshine AI Community License; the two English models are MIT.

## License

The plugin code is MIT — see [`LICENSE`](./LICENSE).
The repository contains no model weights and no training data.

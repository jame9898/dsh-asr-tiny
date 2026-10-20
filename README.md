# dsh-asr-tiny

[![version](https://img.shields.io/badge/version-0.0.1-5b8def)](https://github.com/jame9898/dsh-asr-tiny)
[![DSH](https://img.shields.io/badge/DSH-%3C%3D0.2.1--rc.2-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

English | [中文](./README.zh.md)

Speak into DeepSeek Harness — the text appears in the composer.
Fix a word or two and send; press save to keep it as training data.

Recognition runs on your own machine; audio and text are never uploaded.

![Idle, recording, recognizing and saved](docs/assets/capsule.gif)

## Install

#### 1. Clone

```sh
git clone https://github.com/jame9898/dsh-asr-tiny.git
```

#### 2. Register and install

Add this to `~/.dsh/profiles/desktop/package.json` (keep what is already there):

```json
{
  "dependencies": { "dsh-asr-tiny": "file:<path you cloned into>" },
  "dsh": { "profile": { "bundles": ["…existing bundles…", "dsh-asr-tiny"] } }
}
```

Install with the Node and pnpm that ship inside DSH (not the system pnpm):

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

#### 3. Restart the client

Once the 🎤 ✕ 💾 buttons appear next to the composer, it is installed.
What each file is for: [`docs/structure.md`](docs/structure.md).

## Models

The plugin ships no model; the recognition service picks one of these:

| Model | Language | Notes |
| :--- | :--- | :--- |
| `moonshine-ai/moonshine-tiny-zh` | Chinese | Tested, default |
| `moonshine-ai/moonshine-tiny` | English | Untested |
| `moonshine-ai/moonshine-base` | English | Untested |

**This repository contains no model files.** Download from Hugging Face:
[Chinese](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) ·
[English](https://huggingface.co/moonshine-ai/moonshine-tiny) ·
[English (larger)](https://huggingface.co/moonshine-ai/moonshine-base)

Point `MOONSHINE_MODEL` at an id or a local directory; in mainland China swap the host for
`hf-mirror.com`.

## Data

The recognition service keeps recordings and text in its own `data` directory:
`audio/*.wav` for the recordings, `metadata.csv` for the text. The plugin stores no files.

## License

The plugin code is MIT — see [`LICENSE`](./LICENSE). The repository contains no model weights and
no training data.

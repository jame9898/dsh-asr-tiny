# Reference ASR service

A minimal FastAPI + Moonshine service implementing the four endpoints
[dsh-asr-tiny](../../README.md) talks to. It is a starting point, not production software:
no auth, no queueing, one request at a time, CPU or a single GPU.

## Install

```sh
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
```

### 1. PyTorch — CPU or GPU

The service uses CUDA when `torch.cuda.is_available()`, otherwise CPU. Install the build that
matches the machine **before** the rest of the requirements:

| Machine | Command |
| :--- | :--- |
| CPU only | `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| NVIDIA (CUDA 12.6) | `pip install torch --index-url https://download.pytorch.org/whl/cu126` |

> On Windows, a plain `pip install torch` from PyPI installs the **CPU** build; a CUDA build has to
> come from the index URL above. `requirements.txt` intentionally does not pin torch.

### 2. Everything else

```sh
pip install -r requirements.txt
```

## The model

Pick one with `MOONSHINE_MODEL` (HF model id or a local directory). What has actually been
validated here matters, so it is spelled out:

| Model | Language | Status |
| :--- | :--- | :--- |
| [`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) | Chinese | **Default, tested** — the only model this reference has been run against |
| [`moonshine-ai/moonshine-tiny`](https://huggingface.co/moonshine-ai/moonshine-tiny) | English | Untested — same architecture, expected to load, but verify yourself |
| [`moonshine-ai/moonshine-base`](https://huggingface.co/moonshine-ai/moonshine-base) | English | Untested — larger (61 M params), same caveat |

Notes:

- **First run downloads it** — ≈103 MB for `tiny-zh`, cached under `~/.cache/huggingface`.
- **Mainland China** — point the hub at the mirror before starting:
  `set HF_ENDPOINT=https://hf-mirror.com` (PowerShell: `$env:HF_ENDPOINT = 'https://hf-mirror.com'`).
- **Offline / local copy** — `MOONSHINE_MODEL` accepts a local directory, e.g.
  `$env:MOONSHINE_MODEL = 'D:\models\moonshine-tiny-zh'`.
- **License** — the weights follow the **Moonshine AI Community License** (not MIT); read it before
  redistributing the model. This repository ships no weights.

## Run

```sh
python server.py
curl http://127.0.0.1:8000/health
```

`/health` reports the device it picked:

```json
{"status":"ok","backend":"Moonshine","model":"...","cuda":true,"samples":0}
```

`"cuda": false` means CPU. Either works for short dictation clips; GPU is several times faster.

## Endpoints

| Endpoint | Request | Response |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file` (16 kHz mono WAV) | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`, `asr_hyp`, `duration_s` + `file` | `{"ok": true, "id": "…", "wav_path": "…"}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok", "backend": "Moonshine", "cuda": true, "model": …}` |

## Storage

```
$MOONSHINE_DATA/
  audio/{id}.wav     # 16 kHz mono WAV, one file per saved sample
  metadata.csv       # id, wav_path, text, asr_hyp, created_at, duration_s
```

`text` is the corrected transcript, `asr_hyp` the raw model output. That CSV is the training
label source; a fine-tuning pipeline only needs the `file` and `text` columns.

## Environment

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `MOONSHINE_MODEL` | `moonshine-ai/moonshine-tiny-zh` | HF model id or a local model directory |
| `MOONSHINE_DATA` | `./data` | where WAV files and `metadata.csv` are written |
| `MOONSHINE_PORT` | `8000` | listen port (must match the plugin's ASR URL) |
| `HF_ENDPOINT` | unset | e.g. `https://hf-mirror.com` to use the HF mirror |

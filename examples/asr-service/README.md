# Reference ASR service

A minimal FastAPI + Moonshine service implementing the four endpoints
[dsh-asr-tiny](../../README.md) talks to. It is a starting point, not
production software: no auth, no queueing, one request at a time, CPU or a single GPU.

## Install

```sh
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

## Run

```sh
python server.py
curl http://127.0.0.1:8000/health
```

The first transcription downloads [`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh)
(≈103 MB) unless `MOONSHINE_MODEL` points at a local directory. In mainland China the HF
mirror helps: `HF_ENDPOINT=https://hf-mirror.com`.

```powershell
# Windows PowerShell example
$env:MOONSHINE_MODEL = 'D:\models\moonshine-tiny-zh'
$env:MOONSHINE_DATA  = 'D:\voice-data'
$env:MOONSHINE_PORT  = '8000'
python server.py
```

## Endpoints

| Endpoint | Request | Response |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file` (16 kHz mono WAV) | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`, `asr_hyp`, `duration_s` + `file` | `{"ok": true, "id": "…", "wav_path": "…"}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok", "backend": "Moonshine", "model": …}` |

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

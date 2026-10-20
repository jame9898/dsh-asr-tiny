"""Reference ASR service for dsh-asr-tiny.

Implements the four HTTP endpoints the plugin talks to:

    POST /transcribe   multipart `file` (16 kHz mono WAV) -> {"text", "duration_s"}
    POST /samples      form text/asr_hyp/duration_s + file -> {"ok", "id", "wav_path"}
    GET  /samples      -> {"count", "samples"}
    GET  /health       -> {"status", "backend", "model"}

Storage (relative to MOONSHINE_DATA, default ./data):

    data/audio/{id}.wav     # 16 kHz mono WAV, one file per sample
    data/metadata.csv       # id, wav_path, text, asr_hyp, created_at, duration_s

Environment:
    MOONSHINE_MODEL   HF model id or local directory (default moonshine-ai/moonshine-tiny-zh)
    MOONSHINE_DATA    data directory (default ./data)
    MOONSHINE_PORT    listen port (default 8000)

Run:
    pip install -r requirements.txt
    python server.py
"""

from __future__ import annotations

import csv
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

MODEL_ID = os.environ.get("MOONSHINE_MODEL", "moonshine-ai/moonshine-tiny-zh")
BASE_DIR = Path(os.environ.get("MOONSHINE_DATA", "data")).resolve()
AUDIO_DIR = BASE_DIR / "audio"
METADATA = BASE_DIR / "metadata.csv"
HEADER = ["id", "wav_path", "text", "asr_hyp", "created_at", "duration_s"]

AUDIO_DIR.mkdir(parents=True, exist_ok=True)

_processor = None
_model = None
_device = "cpu"


def load_model():
    """Load the processor and model once; called on the first request."""
    global _processor, _model, _device
    if _model is not None:
        return _processor, _model

    import torch
    from transformers import AutoProcessor, MoonshineForConditionalGeneration

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    _processor = AutoProcessor.from_pretrained(MODEL_ID)
    _model = MoonshineForConditionalGeneration.from_pretrained(MODEL_ID).to(_device)
    _model.eval()
    return _processor, _model


app = FastAPI(title="dsh-asr-tiny reference ASR")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_wav(data: bytes) -> tuple[np.ndarray, int]:
    audio, sample_rate = sf.read(io.BytesIO(data), dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sample_rate


def transcribe(audio: np.ndarray, sample_rate: int) -> str:
    import torch

    processor, model = load_model()
    inputs = processor(audio, return_tensors="pt", sampling_rate=sample_rate).to(_device)
    with torch.no_grad():
        generated = model.generate(**inputs, max_new_tokens=200)
    return processor.decode(generated[0], skip_special_tokens=True)


def append_row(row: dict) -> None:
    new_file = not METADATA.exists()
    with METADATA.open("a", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER)
        if new_file:
            writer.writeheader()
        writer.writerow(row)


@app.get("/health")
def health():
    import torch

    return {
        "status": "ok",
        "backend": "Moonshine",
        "model": MODEL_ID,
        "cuda": torch.cuda.is_available(),
        "samples": list_samples()["count"],
    }


@app.post("/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    audio, sample_rate = read_wav(await file.read())
    text = transcribe(audio, sample_rate)
    return {"text": text, "duration_s": round(len(audio) / sample_rate, 3)}


@app.post("/samples")
async def save_sample(
    text: str = Form(...),
    asr_hyp: str = Form(""),
    duration_s: float = Form(0.0),
    file: UploadFile = File(...),
):
    sample_id = uuid.uuid4().hex[:12]
    wav_path = AUDIO_DIR / f"{sample_id}.wav"
    wav_path.write_bytes(await file.read())
    append_row(
        {
            "id": sample_id,
            "wav_path": str(wav_path),
            "text": text.strip(),
            "asr_hyp": asr_hyp.strip(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "duration_s": round(duration_s, 3),
        }
    )
    return {"ok": True, "id": sample_id, "wav_path": str(wav_path)}


@app.get("/samples")
def list_samples():
    if not METADATA.exists():
        return {"count": 0, "samples": []}
    with METADATA.open(encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    return {"count": len(rows), "samples": rows[-50:]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("MOONSHINE_PORT", "8000")))

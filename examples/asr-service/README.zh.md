# 参考 ASR 服务

一个最小的 FastAPI + Moonshine 服务，实现 [dsh-asr-tiny](../../README.md) 需要的四个接口。
只是起点，不是生产软件：无鉴权、无队列、一次一个请求，CPU 或单卡 GPU 都行。

## 安装

```sh
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
```

### 1. PyTorch —— CPU 还是 GPU（二选一）

服务在 `torch.cuda.is_available()` 为真时用 CUDA，否则回落到 CPU。
**先装匹配机器的 PyTorch**，再装其余依赖：

| 机器 | 命令 |
| :--- | :--- |
| 纯 CPU | `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| NVIDIA（CUDA 12.6） | `pip install torch --index-url https://download.pytorch.org/whl/cu126` |

> Windows 上直接 `pip install torch` 装到的是 **CPU 版**；CUDA 版必须走上面的 index URL。
> `requirements.txt` 故意不锁 torch，就是为了让你自己选。

### 2. 其余依赖

```sh
pip install -r requirements.txt
```

## 模型从哪来

用 `MOONSHINE_MODEL` 选模型（HF 模型 id 或本地目录）。哪些真正验证过很重要，所以写清楚：

| 模型 | 语言 | 状态 |
| :--- | :--- | :--- |
| [`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) | 中文 | **默认，已实测** —— 本参考服务只跑过这一个 |
| [`moonshine-ai/moonshine-tiny`](https://huggingface.co/moonshine-ai/moonshine-tiny) | 英文 | **未测试** —— 架构相同、理论上能加载，但请自行验证 |
| [`moonshine-ai/moonshine-base`](https://huggingface.co/moonshine-ai/moonshine-base) | 英文 | **未测试** —— 参数量更大（61 M），同样需要自行验证 |

其他说明：

- **首次运行自动下载**：中文模型约 103 MB，缓存在 `~/.cache/huggingface`
- **国内网络**：启动前设 `HF_ENDPOINT=https://hf-mirror.com`
  （PowerShell：`$env:HF_ENDPOINT = 'https://hf-mirror.com'`）
- **离线 / 本地目录**：`MOONSHINE_MODEL` 可直接指向本地模型目录，
  例如 `$env:MOONSHINE_MODEL = 'D:\models\moonshine-tiny-zh'`
- **许可**：权重遵循 **Moonshine AI Community License**（不是 MIT），再分发前请先读协议；
  本仓库不含任何权重文件

## 运行

```sh
python server.py
curl http://127.0.0.1:8000/health
```

`/health` 会报告实际用的设备：

```json
{"status":"ok","backend":"Moonshine","model":"...","cuda":true,"samples":0}
```

`"cuda": false` 就表示在 CPU 上跑。短句两种都能用，GPU 快几倍。

## 接口

| 接口 | 请求 | 响应 |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file`（16 kHz 单声道 WAV） | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`、`asr_hyp`、`duration_s` + `file` | `{"ok": true, "id": "…", "wav_path": "…"}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok", "backend": "Moonshine", "cuda": true, ...}` |

## 存储

```
$MOONSHINE_DATA/
  audio/{id}.wav     # 16 kHz 单声道 WAV，一条样本一个文件
  metadata.csv       # id, wav_path, text, asr_hyp, created_at, duration_s
```

`text` 是校正后的文本，`asr_hyp` 是模型原始输出。训练只需要 `file` 和 `text` 两列。

## 环境变量

| 变量 | 默认 | 含义 |
| :--- | :--- | :--- |
| `MOONSHINE_MODEL` | `moonshine-ai/moonshine-tiny-zh` | HF 模型 id，或本地模型目录 |
| `MOONSHINE_DATA` | `./data` | WAV 与 `metadata.csv` 的落盘目录 |
| `MOONSHINE_PORT` | `8000` | 监听端口（要和插件的 ASR 地址一致） |
| `HF_ENDPOINT` | 未设置 | 设为 `https://hf-mirror.com` 走国内镜像 |

# dsh-plugin-asr-zh-tiny

[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.1.0--rc.3%20%3C0.3.0-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) | 中文

一个较小的中文语音识别插件，面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 桌面客户端。
它有两个用途：把你说的话转成文字；以及把录音和校正后的文本保存为训练样本，用来微调属于你自己的语音模型。

- 支持 **DSH 桌面客户端（0.2.x）**。
- 音频与文本不离开本机：插件只访问本地 ASR 服务，不经过任何云服务。
- 插件包含两半：客户端 bundle（输入框工具条 + 设置卡片）与可选的 host 半
  （可把本地 ASR 服务绑定到 DSH 生命周期）。

> **本插件不自带 ASR 引擎**，它只驱动本地 ASR 服务。如果你还没有服务，先用
> [`examples/asr-service`](./examples/asr-service/README.md) 里可运行的参考实现
> （`pip install -r requirements.txt && python server.py`）。

## 特性

- **输入框胶囊**：三个紧凑按钮（🎤 录音、✕ 清空、💾 保存），尺寸与原生 28px 工具按钮一致。
- **连续听写**：每次识别结果**追加**到输入框已有文字之后（中文紧接，英文/数字保留一个空格）。
- **多段合并**：保存前录制的多段音频会合并成同一条样本，段间插入 0.2 秒静音，
  保证文本与音频描述的是同一段话。
- **可编辑文稿**：保存的是你校正后的文本，同时记录模型原始识别结果（`asr_hyp`）。
- **录音反馈**：录音时话筒变红并带呼吸涟漪与三根跳动的音量条；识别/保存显示行内进度；
  失败以红色提示呈现（麦克风被拒、录音无法启动、服务离线、无语音、解码失败、超时）。
- **中英双语 UI**，并提供 ASR 服务地址的设置卡片。

## 前置条件

- DSH `>=0.1.0-rc.3 <0.3.0` —— 桌面客户端 0.2.x。
- Node.js `^22.19.0 || >=24.0.0`。
- 一个实现下列 HTTP 接口的本地 ASR 服务，默认地址 `http://127.0.0.1:8000`。

### ASR 服务接口约定

| 接口 | 请求 | 响应 |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file`（16 kHz 单声道 WAV） | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`、`asr_hyp`、`duration_s` + `file` | `{"ok": true, "id": "..."}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok"}` |

任何实现上述接口的服务都可以。开发本插件时使用的参考实现是一个 FastAPI + Moonshine
（`moonshine-tiny-zh`）服务，样本保存在本地 `data/` 目录下。

### 模型从哪里来

插件**不包含模型**，模型由 ASR 服务负责。参考的 Moonshine 服务使用：

| 模型 | 语言 | 参数量 | 说明 |
| :--- | :--- | ---: | :--- |
| [`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) | 中文 | 27 M | `model.safetensors` 约 103 MB；许可证见模型卡（`other`） |
| [`moonshine-ai/moonshine-tiny`](https://huggingface.co/moonshine-ai/moonshine-tiny) | 英文 | 27 M | MIT |
| [`moonshine-ai/moonshine-base`](https://huggingface.co/moonshine-ai/moonshine-base) | 英文 | 61 M | MIT |

下载一次即可（两种 CLI 写法都可用）：

```sh
huggingface-cli download moonshine-ai/moonshine-tiny-zh --local-dir models/moonshine-tiny-zh
# 新版 CLI：hf download moonshine-ai/moonshine-tiny-zh --local-dir models/moonshine-tiny-zh
# 国内镜像：HF_ENDPOINT=https://hf-mirror.com huggingface-cli download ...
```

也可以直接用 Python 从 hub 加载：

```python
from transformers import AutoProcessor, MoonshineForConditionalGeneration
processor = AutoProcessor.from_pretrained("moonshine-ai/moonshine-tiny-zh")
model = MoonshineForConditionalGeneration.from_pretrained("moonshine-ai/moonshine-tiny-zh")
```

可选：导出 ONNX（`encoder_model.onnx` + `decoder_model.onnx`）以加快启动；参考服务检测到
ONNX 时优先使用，否则回退到 PyTorch 权重。

### 保存的语音存在哪里

插件**不写任何文件**：每条样本都通过 `POST /samples` 交给 ASR 服务，存储完全由服务决定。
参考实现会在自己的工作目录下写入：

```
data/
  audio/{id}.wav       # 16 kHz 单声道 WAV，一条样本一个文件
  metadata.csv         # 列：id, wav_path, text, asr_hyp, created_at, duration_s
```

插件只在 `GET /samples` 读取数量用于按钮徽标；音频最终落在哪里取决于你的服务实现。

## 安装

插件是 out-of-tree 客户端 bundle（`dsh.client` + `dsh.bundle.patch`）。
`lib/` 已随仓库提交，因此从 git 安装无需构建。

### 桌面客户端（DSH 0.2.x）

桌面客户端使用独立 profile 目录（Windows 下为 `~/.dsh/profiles/desktop`）：

1. 在 profile 的 `package.json` 中增加依赖：
   `"dsh-plugin-asr-zh-tiny": "file:<你的本地路径>"`（或 `"github:<owner>/dsh-plugin-asr-zh-tiny"`）。
2. 在 `dsh.profile.bundles` 中增加 `"dsh-plugin-asr-zh-tiny"`。
3. 用客户端自带运行时安装（跳过生命周期脚本，`lib/` 已经是构建好的）：

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

重启客户端即可加载 profile；之后每次启动都会自动加载。客户端 bundle 有轮询热更新，
通常重新构建 + 重装后无需重启。

> DSH 0.2 会校验插件的 `peerDependencies` 版本范围（可选的 peer 也校验）。本插件对
> DSH 客户端包声明 `>=0.1.0-rc.3 <0.3.0`，覆盖 0.2.x。将来发布 0.3.x 时
> 需要放宽该范围，否则插件页会标记为不兼容并拒绝加载。

### 快速开始（桌面客户端，可直接复制）

目标文件：Windows 下 `%USERPROFILE%\.dsh\profiles\desktop\package.json`
（其他系统为 `~/.dsh/profiles/desktop/package.json`）。保留已有的条目：

```json
{
  "dependencies": {
    "dsh-plugin-asr-zh-tiny": "file:E:/path/to/dsh-plugin-asr-zh-tiny"
  },
  "dsh": {
    "profile": {
      "bundles": ["…已有 bundles…", "dsh-plugin-asr-zh-tiny"]
    }
  }
}
```

然后用客户端自带运行时安装，并重启客户端：

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

### 交给 AI 工具安装

仓库是自包含的（`lib/` 已提交，安装**不需要构建**）。把下面这份清单交给 AI 代理即可：

1. **定位 profile**：`%USERPROFILE%\.dsh\profiles\desktop`（Windows）或
   `~/.dsh/profiles/desktop`。
2. **注册插件**：按上面的 JSON 增加 dependency 与 bundle。
3. **安装**：执行上面的客户端自带 pnpm 命令（带 `--ignore-scripts`）。
4. **重启**客户端，让 profile 重新加载。
5. **按下文清单验证**。
6. **可选**：在 `cordis.patch.yml` 里开启 host 端自动拉起服务（见「配置」）。

## 安装验证

- 插件页（插件 → `dsh-plugin-asr-zh-tiny`）列出该 bundle，且**没有异常标记**。
- 输入框工具行出现语音采集胶囊（🎤 ✕ 💾）。
- 插件页出现 ASR 地址设置卡片。
- `curl http://127.0.0.1:8000/health` 返回 `{"status":"ok", ...}`；录音后能产出文字。

## 常见问题

| 现象 | 原因 / 处理 |
| :--- | :--- |
| 插件页显示**异常 / 不兼容** | DSH 版本超出声明的 peer 范围（`>=0.1.0-rc.3 <0.3.0`）。放宽范围后重装。 |
| 输入框没有胶囊 | profile 未重新加载：重启客户端，并确认 `dsh.profile.bundles` 含 `dsh-plugin-asr-zh-tiny`。 |
| 红色提示「识别失败…请确认本地 ASR 服务已启动」 | `/health` 不通。启动服务（见 [`examples/asr-service`](./examples/asr-service/README.md)）。 |
| 录音正常但请求超时 | 服务卡住，或设置卡片里的地址不对。 |
| 桌面上残留控制台窗口 | 服务用 `python.exe` 启动；改用 `pythonw.exe`（见 host 配置）。 |
| `pnpm` 拒绝执行 build scripts | 插件安装不需要构建（`lib/` 已提交）；用 `--ignore-scripts` 安装。 |

## 配置

### 客户端 —— ASR 服务地址

打开插件页（插件 → `dsh-plugin-asr-zh-tiny`），在设置卡片里编辑 **本地 ASR 服务地址**。
该值保存在 `localStorage` 的 `dsh-plugin-asr-zh-tiny.asrBase`；留空恢复默认
`http://127.0.0.1:8000`。

### Host 端 —— 可选的服务生命周期（默认关闭）

默认情况下 host 半只负责注册插件。它也可以随 DSH 启动本地 ASR 服务，并在退出时回收
**由它自己启动的**进程。在 profile 的 `cordis.patch.yml` 中加入：

```yaml
- id: dsh-plugin-asr-zh-tiny
  name: dsh-plugin-asr-zh-tiny
  config:
    asrBase: 'http://127.0.0.1:8000'       # 可选，默认就是它
    autoStart: true                        # 默认 false
    pythonPath: 'C:\path\to\moonshine\venv\Scripts\pythonw.exe'
    serverPath: 'C:\path\to\moonshine\asr\server.py'
    logDir: 'C:\path\to\moonshine\asr'     # 可选，日志会轮转
```

- 仅在端口空闲时接管启动；已在运行的服务不会被重复拉起，也不会被误杀。
- 退出时只回收本插件启动的进程（先优雅 `taskkill /T`，短暂等待后再强制）。
  该生命周期仅 Windows 生效；其他平台退化为普通信号。
- 推荐使用 `pythonw.exe`：以 detached 方式启动 `python.exe` 时，venv 的 redirector 会给
  真实服务分配一个**可见**的新控制台窗口。

## 使用

1. 输入框工具行出现语音采集胶囊。
2. 点 🎤 开始录音，再点一次停止 —— 识别结果**追加**到输入框。
3. 可以继续说下一段来延长草稿，也可以先改错字。
4. 点 💾 保存：累计音频 + 当前输入框文本成为一条样本。
   - **输入框不会被清空** —— 你还可以继续编辑或直接发送。
   - 保存之后再听写，只有新增的部分会计入下一条样本。
5. 点 ✕ 清空草稿并丢弃尚未保存的音频。

## 开发

```sh
pnpm install
pnpm run build        # 清理 lib/ → tsc（host 半 + 类型声明）→ tsdown（客户端 bundle）
pnpm run typecheck
pnpm test             # 构建 + node --test（纯函数单测：文本拼接 / PCM 合并 / WAV 编码）
```

- `src/index.ts` —— host 半：注册插件树 + 可选的 ASR 服务生命周期。
- `src/client/` —— 客户端半：slot 注册（输入框胶囊 + 设置卡片）。
- `src/client/text.ts`、`src/client/audio.ts` —— 纯函数，`tests/` 覆盖。
- `src/config.ts` —— 共享默认值（`DEFAULT_ASR_BASE`、存储 key）。
- CSS Modules 通过 `tsdown.config.ts` 编译进客户端 bundle。

## 许可证

插件代码为 MIT（见 [`LICENSE`](./LICENSE)）。

本仓库**不包含模型权重，也不包含训练数据**。参考服务在运行时加载
[`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh)，
该模型遵循 **Moonshine AI Community License**；使用或再分发前请先阅读该协议。

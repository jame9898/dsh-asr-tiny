# dsh-asr-tiny

[![DSH](https://img.shields.io/badge/DSH-%3C%3D0.2.1--rc.2-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

一个较小的中文语音识别插件，装在 DeepSeek Harness 桌面客户端里。
点 🎤 说话，文字直接进输入框；改完顺手保存，就能攒成自己的语音训练数据。

## 30 秒上手

1. **起本地识别服务**：`<工作区>\scripts\restart_asr.ps1`（或双击 `start_asr.vbs`）。
   看到 `{"status":"ok", ...}` 就算起来了。
2. **装插件**：见下面「安装」，装完重启客户端。
3. **说话**：输入框工具行出现 🎤 ✕ 💾，点 🎤 开始。

## 日常怎么用

| 按钮 | 作用 | 细节 |
| :--- | :--- | :--- |
| 🎤 | 点一下开始录音，再点一下停止并识别 | 文字**追加**到输入框，不覆盖你已经写的内容 |
| ✕ | 清空输入框与未保存的录音 | 已保存的样本不受影响 |
| 💾 | 把「累计录音 + 当前文本」存成一条样本 | **不清空输入框**，还能继续改、继续发 |

实际用起来才会注意到的几个行为：

- **连续听写**：说完一段停一下、再说，文字接着往后加；中文直接相连，英文/数字之间留一个空格。
- **保存后接着写**：保存只消费「上次保存之后新增的部分」，下一句不会重复算进上一条样本。
- **标点**：模型不保证给标点。插件会自动补句末的「。」/「？」，长句在「但是 / 然后 / 所以 / 因为…」前补逗号；不满意直接改。
- **录音中**：按钮变红并出现波形；识别时按钮上方显示「识别中」和跳动点，通常一秒内出字。
- **草稿不会丢**：识别只追加，保存不清空；只有点 ✕ 才会清掉文字。

## 样本存在哪

默认由本地 ASR 服务落盘（插件本身不写文件）：

```
data\audio\{id}.wav       16 kHz 单声道 WAV
data\metadata.csv         id, wav_path, text, asr_hyp, created_at, duration_s
```

- `text` 是**你改过的文本**，训练时当标签用
- `asr_hyp` 是模型原始输出，用来对比
- 训练只需要 `file, text` 两列

## 常见问题

| 现象 | 原因 / 处理 |
| :--- | :--- |
| 点 🎤 没反应 | 麦克风权限被拒（提示「无法访问麦克风」），到系统设置里允许 |
| 识别失败 / 超时 | 本地服务没起：`curl http://127.0.0.1:8000/health`，不通就重启服务 |
| 「识别中」一直不消失 | 服务没响应，或设置里的地址写错了 |
| 识别结果没有标点 | 模型限制；插件只做句末和转折处的补全，建议保存前顺手改 |
| 改了 ASR 地址不生效 | 保存后**下一次录音**才用新地址 |
| 升级后还是旧版 | profile 里留着旧副本：跑 `scripts\upgrade.ps1`，或先删 `node_modules\dsh-asr-tiny` |

## 安装

### 桌面客户端（DSH 0.2.x）

1. 在 profile 的 `package.json` 里登记（保留已有条目）：

```json
{
  "dependencies": { "dsh-asr-tiny": "file:E:/path/to/dsh-asr-tiny" },
  "dsh": { "profile": { "bundles": ["…已有 bundles…", "dsh-asr-tiny"] } }
}
```

2. 用客户端自带运行时安装：

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

3. 重启客户端。

### 交给 AI 代理

把这个仓库交给 AI，让它按顺序做：

1. 确认 `curl http://127.0.0.1:8000/health` 通；不通就先起服务
2. 在 `%USERPROFILE%\.dsh\profiles\desktop\package.json` 加依赖与 bundle（见上）
3. **之前装过就先删** `node_modules\dsh-asr-tiny`，再跑上面的 pnpm 命令
4. 重启客户端
5. 验证：插件页无异常、输入框有胶囊、录一句能出字

### 升级

profile 会把插件复制到自己的 `node_modules`，pnpm 又缓存 `file:` 依赖，所以**只跑 install 不会升级**：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\upgrade.ps1
# 然后重启客户端，插件页会显示新版本号
```

## 配置

- **ASR 地址**：插件页 → 设置卡片，默认 `http://127.0.0.1:8000`，存在 `localStorage`
  （升级不丢；从旧名字 `dsh-plugin-asr-zh-tiny` 迁移时会自动读一次旧 key）
- **随客户端自动起服务**（可选）：profile 的 `cordis.patch.yml`

```yaml
- id: dsh-asr-tiny
  name: dsh-asr-tiny
  config:
    autoStart: true
    pythonPath: 'C:\path\to\moonshine\venv\Scripts\pythonw.exe'
    serverPath: 'C:\path\to\moonshine\asr\server.py'
    logDir: 'C:\path\to\moonshine\asr'
```

## 需要一个什么样的 ASR 服务

插件只负责录音和界面，识别交给本机服务：

| 接口 | 请求 | 响应 |
| :--- | :--- | :--- |
| `POST /transcribe` | multipart `file`（16 kHz 单声道 WAV） | `{"text": "...", "duration_s": 9.8}` |
| `POST /samples` | form `text`、`asr_hyp`、`duration_s` + `file` | `{"ok": true, "id": "..."}` |
| `GET /samples` | — | `{"count": N, "samples": [...]}` |
| `GET /health` | — | `{"status": "ok"}` |

任何实现这四个接口的服务都能用。`examples/asr-service` 里有一个可直接跑的参考实现：

```sh
cd examples/asr-service
pip install -r requirements.txt
python server.py
```

## 开发

```sh
pnpm install
pnpm run build        # tsc（host 半 + 类型）+ tsdown（客户端 bundle）
pnpm run typecheck
pnpm test             # 15 个单测：标点/拼接、PCM 合并、WAV 编码
```

- `src/index.ts` —— host 半：注册插件，可选托管本地 ASR 进程
- `src/client/` —— 客户端半：输入框胶囊 + 设置卡片
- `src/client/text.ts` —— 空格归一、标点补全、草稿拼接（`tests/` 覆盖）
- `src/client/audio.ts` —— 解码、重采样到 16 kHz、WAV 编码

## License

插件代码 MIT（见 [`LICENSE`](./LICENSE)）。本仓库不含模型权重与训练数据；参考服务在运行时加载
[`moonshine-ai/moonshine-tiny-zh`](https://huggingface.co/moonshine-ai/moonshine-tiny-zh)，
该模型遵循 Moonshine AI Community License。

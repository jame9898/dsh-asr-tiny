# dsh-asr-tiny

[![version](https://img.shields.io/badge/version-0.0.2-5b8def)](https://github.com/jame9898/dsh-asr-tiny)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.1.0--rc.3%20%3C0.3.0-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) | 中文

在 DeepSeek Harness 里直接说话，文字自动出现在输入框。
改一改就能发送；想留作训练数据，点一下保存即可。

识别在本机跑，录音和文字都不会上传。

![空闲、录音中、识别中、已保存](docs/assets/capsule.gif)

## 安装

#### 1. 克隆仓库

```sh
git clone https://github.com/jame9898/dsh-asr-tiny.git
```

#### 2. 登记并安装

在 `~/.dsh/profiles/desktop/package.json` 里加上（保留已有内容）：

```json
{
  "dependencies": { "dsh-asr-tiny": "file:<克隆下来的目录>" },
  "dsh": { "profile": { "bundles": ["…已有 bundles…", "dsh-asr-tiny"] } }
}
```

用 DSH 客户端自带的 Node 和 pnpm 安装（别用系统里的 pnpm）：

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

#### 3. 重启客户端

输入框旁边出现 🎤 ✕ 💾 就好了。各文件用途见 [`docs/structure.md`](docs/structure.md)。

## 模型

插件不带模型，识别服务启动时用下面某一个：

| 模型 | 语言 | 说明 |
| :--- | :--- | :--- |
| `moonshine-ai/moonshine-tiny-zh` | 中文 | 已实测，默认 |
| `moonshine-ai/moonshine-tiny` | 英文 | 未实测 |
| `moonshine-ai/moonshine-base` | 英文 | 未实测 |

**本仓库不含模型文件**，去 Hugging Face 下载：
[中文](https://huggingface.co/moonshine-ai/moonshine-tiny-zh) ·
[英文](https://huggingface.co/moonshine-ai/moonshine-tiny) ·
[英文（更大）](https://huggingface.co/moonshine-ai/moonshine-base)

用 `MOONSHINE_MODEL` 指定（仓库名或本地目录）；国内网络可以把域名换成 `hf-mirror.com`。

## 数据

识别服务把录音和文字存在自己的 `data` 目录：`audio/*.wav` 是录音，`metadata.csv` 是文字。
插件本身不存文件。

## 许可

插件代码 MIT，见 [`LICENSE`](./LICENSE)。仓库不含模型权重和训练数据。

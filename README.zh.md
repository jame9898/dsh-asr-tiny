# dsh-asr-tiny

[![version](https://img.shields.io/badge/version-0.0.1-5b8def)](https://github.com/jame9898/dsh-asr-tiny)
[![DSH](https://img.shields.io/badge/DSH-%3C%3D0.2.1--rc.2-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) | 中文

在 DeepSeek Harness 里直接说话，文字自动出现在输入框。

说出来，文字就出来了；改一改，直接发送。
想留作训练数据的话，点一下保存，这条录音和文字就会存下来，
以后可以拿去微调属于你自己的语音模型。

识别在你自己的电脑上跑，录音和文字都不会上传。

![空闲、录音中、识别中、已保存四种状态](docs/assets/capsule.gif)

## 安装

把仓库地址交给 AI，让它先克隆、读一遍、再动手装。

#### 1. 克隆仓库

```sh
git clone https://github.com/jame9898/dsh-asr-tiny.git
```

#### 2. 文件

| 文件 / 目录 | 作用 |
| :--- | :--- |
| `package.json` | 插件声明：名字、版本、客户端入口（`dsh.client`） |
| `cordis.patch.yml` | 把插件挂进 DSH 的插件树 |
| `src/index.ts` | 后台半：注册插件，可选代管识别服务进程 |
| `src/client/` | 界面半：输入框旁的按钮、设置卡片、录音与文字处理 |
| `lib/` | 构建好的插件包（仓库里已带，不用再构建） |
| `examples/asr-service/` | 参考识别服务（FastAPI + Moonshine），可选 |
| `scripts/upgrade.ps1` | 升级已经装过的旧版本 |
| `tests/` | 单元测试 |

#### 3. 准备识别服务

没有现成的，就用 `examples/asr-service`（用 CPU 还是 GPU 都行，那里的说明写得很细）。

#### 4. 登记插件并安装

在 profile 的 `package.json` 里加上（保留原来就有的内容）：

```json
{
  "dependencies": { "dsh-asr-tiny": "file:<克隆下来的目录>" },
  "dsh": { "profile": { "bundles": ["…已有 bundles…", "dsh-asr-tiny"] } }
}
```

用 DSH 客户端安装目录里自带的 Node 和 pnpm 来装（不要用系统里的 pnpm）：

```powershell
D:\dsh\resources\runtime\primary-runtime\dependencies\node\bin\node.exe `
  D:\dsh\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs install --ignore-scripts
```

> 装过旧版本的话，先删掉 `node_modules\dsh-asr-tiny` 再装，否则加载的还是旧版。

#### 5. 重启客户端

输入框旁边出现 🎤 ✕ 💾 就装好了。

第一次识别会自动下载中文模型（大约 100 MB）；国内网络慢，可以先设镜像：`set HF_ENDPOINT=https://hf-mirror.com`。

## 数据存放

识别服务会把它们存在自己的 `data` 目录里：

- `audio/*.wav` —— 录音文件
- `metadata.csv` —— 文字和对应关系

插件本身不存文件，卸载插件也不会丢数据。

## ASR识别模型

插件本身不带模型，识别服务启动时会挑下面某一个来用：

| 模型 | 语言 | 说明 |
| :--- | :--- | :--- |
| `moonshine-ai/moonshine-tiny-zh` | 中文 | 已实测 |
| `moonshine-ai/moonshine-tiny` | 英文 | 架构相同，**未实测** |
| `moonshine-ai/moonshine-base` | 英文 | **未实测** |

**本仓库不包含任何模型文件。** 需要哪个，去 Hugging Face 的对应仓库下载：

- 中文：https://huggingface.co/moonshine-ai/moonshine-tiny-zh
- 英文：https://huggingface.co/moonshine-ai/moonshine-tiny
- 英文（更大）：https://huggingface.co/moonshine-ai/moonshine-base

国内网络可以用镜像，把域名换成 `hf-mirror.com` 即可，例如
https://hf-mirror.com/moonshine-ai/moonshine-tiny-zh 。

下载后不需要手动配置：识别服务第一次启动会用 `MOONSHINE_MODEL` 指定的模型
（填 Hugging Face 仓库名或本地目录都行），默认就是中文那个。

许可：中文模型遵循 Moonshine AI Community License；两个英文模型是 MIT。

## 许可

插件代码是 MIT，见 [`LICENSE`](./LICENSE)。
仓库里不含模型权重和训练数据。

# 仓库结构 | Repository layout

各文件 / 目录的用途，给接手的人或 AI 看。

| 文件 / 目录 | 作用 |
| :--- | :--- |
| `package.json` | 插件声明：名字、版本、客户端入口（`dsh.client`）、打包文件列表 |
| `cordis.patch.yml` | 把插件挂进 DSH 的插件树 |
| `src/index.ts` | 后台半：注册插件，可选代管本地识别服务进程 |
| `src/client/` | 界面半：输入框旁的按钮、设置卡片、录音与文字处理 |
| `lib/` | 构建好的插件包（已提交，安装不需要再构建） |
| `examples/asr-service/` | 参考识别服务（FastAPI + Moonshine），可选 |
| `scripts/upgrade.ps1` | 升级已经装过的旧版本 |
| `scripts/check-client-bundle.mjs` | CI 用：检查客户端 bundle 的模块引用 |
| `tests/` | 单元测试（标点与拼接、PCM 合并、WAV 编码） |
| `docs/assets/capsule.gif` | README 里的四种状态动图 |

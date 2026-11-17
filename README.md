# ChatGPT (Codex) 桌面版界面汉化包

让 ChatGPT / Codex 桌面版（MSIX）在无法访问 `ab.chatgpt.com` 的网络环境下也能显示中文界面。

详细原理、维护指南见 [说明.md](说明.md)。

## 原理一句话

客户端本地已内置 15000+ 条中文词条，但加载与否取决于远端 Statsig 开关 `enable_i18n`。本工具通过 Chrome DevTools 协议向 webview 的 localStorage 写入一条"开关已打开"的缓存条目，客户端启动后即加载中文，无需联网、不修改任何安装文件。

## 文件说明

| 文件 | 用途 |
|---|---|
| `start-codex-zh.cmd` | 启动脚本：清理残留进程后带调试端口启动 Codex |
| `codex-zh-fix.mjs` | 缓存注入工具：注入 / `--revert` 回退 / `--inspect` 检查 |
| `check-ui.mjs` | 只读检查当前界面语言状态 |
| `重建快捷方式.mjs` | Codex 升级后重建桌面快捷方式 |

## 快速开始

```powershell
# 1. 注入（需先安装 Node.js 18+）
node codex-zh-fix.mjs

# 2. 验证界面语言
node check-ui.mjs

# 3. 回退（如需恢复原状）
node codex-zh-fix.mjs --revert
```

日常使用直接双击由 `start-codex-zh.cmd` 生成的快捷方式即可。

## 注意事项

- 适用版本：`OpenAI.Codex 26.1111.2228.0`。Codex 升级后需按 [说明.md](说明.md) 第四节更新脚本中的版本号。
- 启动参数 `--remote-debugging-port=9222` 只监听本机 `127.0.0.1`。
- 不修改任何安装目录文件、不改 config.toml、不动系统设置；`--revert` 可完全恢复原状。
- 仅限个人本地使用；请遵守 OpenAI 的服务条款。

## 环境

- Windows 10/11（MSIX 桌面版客户端）
- Node.js 18+（使用了内置 WebSocket 与 fetch）

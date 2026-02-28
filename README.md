<div align="center">

# GuYu Mate

Claude Code CLI 配置管理工具

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/SuxyEE/GuYu-Mate/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/SuxyEE/GuYu-Mate/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

</div>

## 功能

- **供应商管理**：一键切换 Claude Code API 配置
- **MCP 服务器管理**：统一管理 MCP 服务器配置
- **Prompts 管理**：多预设系统提示词管理
- **Skills 管理**：从 GitHub 仓库发现和安装 Claude Skills
- **深链接导入**：通过 `guyumate://` 协议一键导入配置
- **WebDAV 同步**：跨设备配置同步
- **一键环境安装**：自动检测并安装 Node.js 运行环境
- **系统托盘**：快速切换供应商
- **自动更新**：内置更新检查

## 预设供应商

- 谷雨大模型 (https://code.o2oe.net/)

## 下载安装

从 [Releases](../../releases) 页面下载最新版本：

- **Windows**: `GuYu-Mate-v1.0.0-Windows.msi.zip` 或便携版
- **macOS**: `GuYu-Mate-v1.0.0-macOS.zip`
- **Linux**: `.deb` / `.AppImage` / `.flatpak`

> macOS 首次启动可能提示"未知开发者"，请前往"系统设置" → "隐私与安全性" → 点击"仍要打开"。

## 开发

```bash
pnpm install
pnpm dev
pnpm build
```

### 环境要求

- Node.js 18+ / pnpm 8+ / Rust 1.85+ / Tauri CLI 2.8+

## 数据存储

- 数据库：`~/.guyu-mate/guyu-mate.db`
- 本地设置：`~/.guyu-mate/settings.json`
- 备份：`~/.guyu-mate/backups/`

## 技术栈

**前端**: React 18 · TypeScript · Vite · TailwindCSS · TanStack Query · shadcn/ui

**后端**: Tauri 2.8 · Rust · SQLite · tokio

## License

MIT

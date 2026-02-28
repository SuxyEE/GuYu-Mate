# GuYu Mate 官网部署指南

## 目录结构

```
website/
├── index.html          # 主页
├── style.css           # 样式
├── script.js           # 交互逻辑
├── assets/
│   └── logo.jpg        # Logo 图片
└── releases/
    ├── latest.json     # Tauri 自动更新接口
    └── (安装包文件)     # 上传到这里
```

## 宝塔部署步骤

1. 在宝塔面板创建一个网站，绑定你的域名
2. 将 `website/` 目录下的所有文件上传到网站根目录
3. 修改两个配置：
   - `script.js` 顶部的 `SITE_CONFIG.baseUrl` 改为你的域名
   - `releases/latest.json` 中的下载链接已指向 GitHub Releases

## 发布新版本流程

1. 将新版本安装包上传到 `releases/` 目录
2. 更新 `releases/latest.json` 中的版本号、下载链接和签名
3. 更新 `script.js` 中 `CHANGELOG` 数组，添加新版本记录

## Tauri 签名说明

`latest.json` 中的 `signature` 字段需要使用 Tauri 的签名工具生成：

```bash
# 构建时会自动生成 .sig 签名文件
pnpm tauri build

# 签名文件在构建产物旁边，如：
# target/release/bundle/msi/GuYu-Mate-v3.12.0.msi.zip.sig
```

将 `.sig` 文件的内容填入 `latest.json` 对应平台的 `signature` 字段。

## Nginx 配置（宝塔自动生成，如需手动调整）

确保 `releases/` 目录允许直接下载文件：

```nginx
location /releases/ {
    add_header Access-Control-Allow-Origin *;
    add_header Content-Disposition "attachment";
}
```

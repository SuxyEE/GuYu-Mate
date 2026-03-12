#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platforms = [
  { target: 'node18-win-x64', ext: '.exe', name: 'agent-bridge-x86_64-pc-windows-msvc' },
  { target: 'node18-macos-x64', ext: '', name: 'agent-bridge-x86_64-apple-darwin' },
  { target: 'node18-macos-arm64', ext: '', name: 'agent-bridge-aarch64-apple-darwin' },
  { target: 'node18-linux-x64', ext: '', name: 'agent-bridge-x86_64-unknown-linux-gnu' }
];

const distDir = path.join(__dirname, '..', 'binaries');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 先用 ncc 打包成单文件
console.log('📦 使用 ncc 打包...');
execSync('npx ncc build index.js -o dist', { cwd: __dirname, stdio: 'inherit' });

// 再用 pkg 打包成可执行文件
console.log('🔨 生成平台可执行文件...');
for (const { target, ext, name } of platforms) {
  try {
    execSync(`npx pkg dist/index.js --target ${target} --output ${path.join(distDir, name + ext)}`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log(`✅ ${name}${ext}`);
  } catch (e) {
    console.error(`❌ ${name}${ext} 失败`);
  }
}

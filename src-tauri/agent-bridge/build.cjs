const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platforms = [
  { target: 'node18-win-x64', ext: '.exe', name: 'agent-bridge-x86_64-pc-windows-msvc' },
  { target: 'node18-macos-x64', ext: '', name: 'agent-bridge-x86_64-apple-darwin' },
  { target: 'node18-macos-arm64', ext: '', name: 'agent-bridge-aarch64-apple-darwin' },
];

const distDir = path.join(__dirname, '..', 'binaries');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('🔨 使用 pkg 打包可执行文件...');
for (const { target, ext, name } of platforms) {
  const output = path.join(distDir, name + ext);
  try {
    execSync(`npx pkg index.js --target ${target} --output "${output}"`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log(`✅ ${name}${ext}`);
  } catch (e) {
    console.error(`❌ ${name}${ext} 失败:`, e.message);
  }
}

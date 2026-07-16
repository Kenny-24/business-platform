#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "花予商户后台"
echo "当前目录：$SCRIPT_DIR"
echo ""

if [ ! -d "node_modules" ]; then
  echo "首次运行，正在安装依赖..."
  npm install --no-audit --no-fund
fi

echo "启动开发服务器..."
npm run dev

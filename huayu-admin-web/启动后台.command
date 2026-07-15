#!/bin/zsh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 18 或更高版本。"
  read -n 1 -s -r -p "按任意键退出"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "首次启动，正在安装依赖……"
  npm install
fi

npm run dev

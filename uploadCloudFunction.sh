#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "请在微信开发者工具中打开：$ROOT_DIR"
echo "然后分别右键以下目录并选择：上传并部署：云端安装依赖"
echo "  cloudfunctions/getHomeData"
echo "  cloudfunctions/adminApi"

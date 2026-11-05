#!/bin/bash
cd "$(dirname "$0")"
clear
echo "ちゃいろのこびん Mac親機を起動します..."
echo ""
python3 server.py
echo ""
read -p "Enterキーで閉じます。"

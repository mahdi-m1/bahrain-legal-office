#!/bin/bash
cd "$(dirname "$0")"
echo "تشغيل مكتب قانوني بحريني..."
if [ ! -d node_modules ]; then
  echo "تثبيت الاعتماديات..."
  npm install
fi
[ -f .env ] || cp .env.example .env
node backend/src/server.js

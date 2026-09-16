#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "=== إعداد مكتب قانوني بحريني ==="
npm install
[ -f .env ] || cp .env.example .env
mkdir -p ~/.claude input output archive logs cases
if [ ! -f ~/.claude/settings.json ]; then
  cat > ~/.claude/settings.json << 'INNER'
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "teammateMode": "tmux"
}
INNER
  echo "تم إنشاء ~/.claude/settings.json"
fi
echo "✅ جاهز — شغّل: npm start"

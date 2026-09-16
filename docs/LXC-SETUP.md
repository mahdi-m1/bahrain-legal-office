# تشغيل المشروع داخل LXC

## 1. إنشاء حاوية LXC (Ubuntu 24.04 مثال)
```bash
lxc launch ubuntu:24.04 bahrain-legal
lxc exec bahrain-legal -- bash
```

## 2. داخل الحاوية
```bash
# تحديث
apt update && apt install -y curl git tmux build-essential

# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# تثبيت Claude Code
npm install -g @anthropic-ai/claude-code
# ثم سجّل الدخول: claude  (اتبع تعليمات المصادقة)

# رفع المشروع (من الجهاز المضيف)
# lxc file push -r ./bahrain-legal-office bahrain-legal/root/

cd /root/bahrain-legal-office
npm install
cp .env.example .env

# تفعيل Agent Teams
mkdir -p ~/.claude
cat > ~/.claude/settings.json << 'INNER'
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
INNER

# تشغيل
npm run start
```

## 3. فتح المنفذ
من الجهاز المضيف:
```bash
lxc config device add bahrain-legal web proxy listen=tcp:0.0.0.0:3847 connect=tcp:127.0.0.1:3847
```

ثم افتح: http://IP-الحاوية:3847

## ملاحظات
- يجب أن يكون Claude Code مصادقاً داخل الحاوية.
- المجلدات input/output/archive تُحفظ داخل الحاوية أو اربطها بـ volume.

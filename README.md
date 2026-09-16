# مكتب قانوني بحريني متكامل | Bahrain Legal Office AI

نظام إدارة مكتب استشارات قانونية بحريني مدعوم بـ **Claude Code Agent Teams**.

## المميزات
- واجهة ويب عربية للتحكم الكامل
- قضايا منفصلة مع توليد مجلدات تلقائي
- رفع / تنزيل / أرشفة ملفات
- فريق وكلاء: تحليل، بحث قانوني، مذكرات، طعون
- تصدير التقارير إلى **PDF** و **Word**
- أمان مسارات (Path Traversal protection)
- مصادر رسمية بحرينية فقط (lloc.gov.bh / ahkam.sjc.bh)

## المتطلبات
- Node.js 20+
- Claude Code CLI مثبت ومصادق (`claude`)
- tmux (موصى به)

## التثبيت والتشغيل

```bash
git clone https://github.com/mahdi-m1/bahrain-legal-office.git
cd bahrain-legal-office
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
npm start
```

افتح: **http://localhost:3847**

### أوامر مختصرة
```bash
./scripts/setup.sh   # إعداد أولي
./start.sh           # تشغيل سريع
npm run agents       # تشغيل الفريق من الطرفية
```

## الاستخدام
1. تبويب **القضايا** → أنشئ قضية جديدة (تُنشأ المجلدات تلقائياً)
2. **رفع ملفات** إلى input/
3. **تشغيل الفريق** أو أرسل أمراً سريعاً
4. راجع **النتائج** وصدّر PDF/Word
5. **الأرشيف** للتنزيل لاحقاً

## Docker
```bash
docker compose up --build
```

## LXC
راجع `docs/LXC-SETUP.md`

## تحذير قانوني
هذا النظام **مساعد فقط**. لا يُعتبر استشارة قانونية رسمية. يجب مراجعة محامٍ مرخص في البحرين قبل الاعتماد على أي مخرجات.

## الترخيص
MIT

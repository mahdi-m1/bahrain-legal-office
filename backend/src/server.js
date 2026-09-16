const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { resolveSafePath, isAllowedUpload, isAllowedDownload } = require('./services/pathSecurity');
const { exportReport, exportToWord, exportToPdf } = require('./services/exportReports');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3847;
const ROOT = path.resolve(process.env.PROJECT_ROOT || path.join(__dirname, '..', '..'));
const CASES_ROOT = path.join(ROOT, 'cases');
const DEFAULT_INPUT = path.join(ROOT, 'input');
const DEFAULT_OUTPUT = path.join(ROOT, 'output');
const DEFAULT_ARCHIVE = path.join(ROOT, 'archive');
const LOGS_DIR = path.join(ROOT, 'logs');
const LAST_CASE_FILE = path.join(LOGS_DIR, 'last-case.txt');

fs.ensureDirSync(CASES_ROOT);
fs.ensureDirSync(DEFAULT_INPUT);
fs.ensureDirSync(DEFAULT_OUTPUT);
fs.ensureDirSync(DEFAULT_ARCHIVE);
fs.ensureDirSync(LOGS_DIR);

let currentCaseId = null;
try {
  if (fs.existsSync(LAST_CASE_FILE)) {
    const last = fs.readFileSync(LAST_CASE_FILE, 'utf8').trim();
    if (last && fs.existsSync(path.join(CASES_ROOT, last))) currentCaseId = last;
  }
} catch (_) {}

function getCaseDirs() {
  if (currentCaseId) {
    const base = path.join(CASES_ROOT, currentCaseId);
    return {
      base,
      input: path.join(base, 'input'),
      output: path.join(base, 'output'),
      archive: path.join(base, 'archive'),
      extracted: path.join(base, 'extracted'),
      review: path.join(base, 'review'),
      meta: path.join(base, 'meta.json')
    };
  }
  return {
    base: ROOT,
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    archive: DEFAULT_ARCHIVE,
    extracted: path.join(ROOT, 'extracted'),
    review: path.join(ROOT, 'review'),
    meta: null
  };
}

async function ensureCaseDirs(caseId) {
  const base = path.join(CASES_ROOT, caseId);
  for (const d of ['input', 'output', 'archive', 'extracted', 'review']) {
    await fs.ensureDir(path.join(base, d));
  }
  return base;
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.static(path.join(ROOT, 'frontend/public')));

app.get('/api/status', async (req, res) => {
  const dirs = getCaseDirs();
  const count = async (p) => {
    try { return (await fs.readdir(p)).filter(n => !n.startsWith('.')).length; } catch { return 0; }
  };
  res.json({
    status: 'running',
    currentCase: currentCaseId,
    inputCount: await count(dirs.input),
    outputCount: await count(dirs.output),
    archiveCount: await count(dirs.archive),
    teamActive: !!global.claudeProcess
  });
});

app.get('/api/paths', (req, res) => {
  res.json({ root: ROOT, currentCase: currentCaseId, dirs: getCaseDirs() });
});

app.post('/api/cases', async (req, res) => {
  try {
    const { title, caseNumber, court, client } = req.body || {};
    if (!title && !caseNumber) return res.status(400).json({ error: 'يجب إدخال عنوان أو رقم القضية' });
    const date = new Date().toISOString().slice(0, 10);
    const raw = (caseNumber || title || 'قضية').toString();
    const safeName = raw.replace(/[^\u0600-\u06FFa-zA-Z0-9\-_ ]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'issue';
    const folderName = `${date}-${safeName}`;
    const casePath = await ensureCaseDirs(folderName);
    const meta = {
      id: folderName,
      title: title || caseNumber || folderName,
      caseNumber: caseNumber || '',
      court: court || '',
      client: client || '',
      createdAt: new Date().toISOString(),
      status: 'open',
      path: casePath
    };
    await fs.writeJson(path.join(casePath, 'meta.json'), meta, { spaces: 2 });
    currentCaseId = folderName;
    await fs.writeFile(LAST_CASE_FILE, folderName, 'utf8');
    io.emit('cases-updated');
    res.json({ success: true, case: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cases', async (req, res) => {
  try {
    const folders = await fs.readdir(CASES_ROOT);
    const cases = [];
    for (const f of folders) {
      const metaPath = path.join(CASES_ROOT, f, 'meta.json');
      if (await fs.pathExists(metaPath)) cases.push(await fs.readJson(metaPath));
    }
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ cases, current: currentCaseId });
  } catch {
    res.json({ cases: [], current: null });
  }
});

app.post('/api/cases/:id/select', async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await fs.pathExists(path.join(CASES_ROOT, id)))) {
      return res.status(404).json({ error: 'القضية غير موجودة' });
    }
    await ensureCaseDirs(id);
    currentCaseId = id;
    await fs.writeFile(LAST_CASE_FILE, id, 'utf8');
    res.json({ success: true, current: id, dirs: getCaseDirs() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', (req, res) => {
  const dirs = getCaseDirs();
  fs.ensureDirSync(dirs.input);
  const storage = multer.diskStorage({
    destination: (req2, file, cb) => {
      const d = getCaseDirs();
      fs.ensureDirSync(d.input);
      cb(null, d.input);
    },
    filename: (req2, file, cb) => {
      const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const safe = original.replace(/[<>:"/\\|?*]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB) || 50) * 1024 * 1024 },
    fileFilter: (req2, file, cb) => {
      if (!isAllowedUpload(file.originalname)) return cb(new Error('نوع الملف غير مسموح'));
      cb(null, true);
    }
  });
  upload.array('files', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const files = (req.files || []).map(f => ({ name: f.filename, original: f.originalname, size: f.size }));
    io.emit('files-updated');
    res.json({ success: true, files, case: currentCaseId });
  });
});

app.get('/api/files/:dir', async (req, res) => {
  const allowed = ['input', 'output', 'archive', 'extracted', 'review'];
  if (!allowed.includes(req.params.dir)) return res.status(400).json({ error: 'مجلد غير مسموح' });
  const dirs = getCaseDirs();
  const target = dirs[req.params.dir];
  if (!target) return res.json([]);
  try {
    await fs.ensureDir(target);
    const files = await fs.readdir(target);
    const detailed = await Promise.all(
      files.filter(n => !n.startsWith('.')).map(async name => {
        const full = path.join(target, name);
        const stat = await fs.stat(full);
        return { name, size: stat.size, mtime: stat.mtime };
      })
    );
    detailed.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json(detailed);
  } catch { res.json([]); }
});

app.get('/api/download/:dir/:filename', async (req, res) => {
  try {
    const allowed = ['input', 'output', 'archive', 'extracted', 'review'];
    if (!allowed.includes(req.params.dir)) return res.status(400).json({ error: 'مجلد غير مسموح' });
    const dirs = getCaseDirs();
    const safePath = resolveSafePath(dirs[req.params.dir], req.params.filename);
    if (!(await fs.pathExists(safePath))) return res.status(404).json({ error: 'الملف غير موجود' });
    if (!isAllowedDownload(req.params.filename)) return res.status(403).json({ error: 'نوع الملف غير مسموح' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(safePath);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.delete('/api/files/:dir/:filename', async (req, res) => {
  try {
    const allowed = ['input', 'output', 'archive', 'extracted', 'review'];
    if (!allowed.includes(req.params.dir)) return res.status(400).json({ error: 'مجلد غير مسموح' });
    const dirs = getCaseDirs();
    const safePath = resolveSafePath(dirs[req.params.dir], req.params.filename);
    await fs.remove(safePath);
    io.emit('files-updated');
    res.json({ success: true });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/archive/:filename', async (req, res) => {
  try {
    const dirs = getCaseDirs();
    const src = resolveSafePath(dirs.output, req.params.filename);
    const dest = resolveSafePath(dirs.archive, req.params.filename);
    if (!(await fs.pathExists(src))) return res.status(404).json({ error: 'غير موجود' });
    await fs.move(src, dest, { overwrite: true });
    io.emit('files-updated');
    res.json({ success: true });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/export/:filename', async (req, res) => {
  try {
    const dirs = getCaseDirs();
    const sourcePath = resolveSafePath(dirs.output, req.params.filename);
    if (!(await fs.pathExists(sourcePath))) return res.status(404).json({ error: 'الملف غير موجود' });
    let meta = {};
    if (dirs.meta && await fs.pathExists(dirs.meta)) meta = await fs.readJson(dirs.meta);
    const result = await exportReport(sourcePath, dirs.output, {
      title: meta.title || req.params.filename,
      caseNumber: meta.caseNumber || ''
    });
    io.emit('files-updated');
    res.json({ success: true, word: path.basename(result.word), pdf: path.basename(result.pdf) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/export-text', async (req, res) => {
  try {
    const { content, title, format } = req.body || {};
    if (!content) return res.status(400).json({ error: 'لا يوجد محتوى' });
    const dirs = getCaseDirs();
    await fs.ensureDir(dirs.output);
    const stamp = Date.now();
    const base = (title || 'تقرير').replace(/[^\u0600-\u06FFa-zA-Z0-9\-_]/g, '_');
    const files = {};
    if (!format || format === 'docx' || format === 'both') {
      const p = path.join(dirs.output, `${base}-${stamp}.docx`);
      await exportToWord(content, p, { title: title || 'تقرير قانوني' });
      files.word = path.basename(p);
    }
    if (format === 'pdf' || format === 'both') {
      const p = path.join(dirs.output, `${base}-${stamp}.pdf`);
      await exportToPdf(content, p, { title: title || 'Legal Report' });
      files.pdf = path.basename(p);
    }
    io.emit('files-updated');
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getDefaultTeamPrompt() {
  const dirs = getCaseDirs();
  return `أنشئ فريقاً قانونياً متخصصاً في القانون البحريني.\nالمجلدات: ${dirs.base}\ninput: ${dirs.input}\noutput: ${dirs.output}\nاستخدم skills: document-extraction, legal-analysis, report-writing, export-pdf-word.\nمصادر رسمية فقط. بعد كل تقرير صدّر PDF و Word.`;
}

app.post('/api/team/start', (req, res) => {
  if (global.claudeProcess) return res.json({ success: false, message: 'الفريق يعمل بالفعل' });
  const prompt = req.body.prompt || getDefaultTeamPrompt();
  const logFile = path.join(LOGS_DIR, `team-${Date.now()}.log`);
  const env = { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1', TEAMMATE_MODE: process.env.TEAMMATE_MODE || 'tmux' };
  const child = spawn('claude', ['-p', prompt], { cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const logStream = fs.createWriteStream(logFile);
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  global.claudeProcess = child;
  child.on('exit', () => { global.claudeProcess = null; io.emit('team-status', { active: false }); });
  io.emit('team-status', { active: true, pid: child.pid });
  res.json({ success: true, pid: child.pid, log: logFile });
});

app.post('/api/team/stop', (req, res) => {
  if (!global.claudeProcess) return res.json({ success: false, message: 'لا يوجد فريق نشط' });
  try { process.kill(-global.claudeProcess.pid, 'SIGTERM'); } catch (_) {
    try { global.claudeProcess.kill('SIGTERM'); } catch (__) {}
  }
  global.claudeProcess = null;
  io.emit('team-status', { active: false });
  res.json({ success: true });
});

app.post('/api/team/command', (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });
  const child = spawn('claude', ['-p', command], {
    cwd: ROOT,
    env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' },
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  res.json({ success: true, message: 'تم إرسال الأمر' });
});

app.get('/api/logs/latest', async (req, res) => {
  try {
    const files = (await fs.readdir(LOGS_DIR)).filter(f => f.endsWith('.log')).sort().reverse();
    if (!files.length) return res.json({ content: '' });
    const content = await fs.readFile(path.join(LOGS_DIR, files[0]), 'utf8');
    res.json({ content: content.slice(-15000), file: files[0] });
  } catch { res.json({ content: '' }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT, 'frontend/public/index.html'));
});

server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`\n✅ مكتب قانوني بحريني → http://localhost:${PORT}`);
  console.log(`   القضية الحالية: ${currentCaseId || '(لا يوجد)'}\n`);
});

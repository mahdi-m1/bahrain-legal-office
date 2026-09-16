const path = require('path');

function resolveSafePath(baseDir, userFilename) {
  if (!userFilename || typeof userFilename !== 'string') {
    throw new Error('اسم الملف غير صالح');
  }
  if (userFilename.includes('\0') || path.isAbsolute(userFilename)) {
    throw new Error('مسار غير مسموح');
  }
  const cleaned = path.basename(userFilename)
    .replace(/[<>:"|?*\\]/g, '_')
    .replace(/\.\./g, '')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('اسم الملف فارغ أو غير صالح');
  }
  const fullPath = path.resolve(baseDir, cleaned);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!fullPath.startsWith(normalizedBase) && fullPath !== path.resolve(baseDir)) {
    throw new Error('محاولة خروج عن المجلد المسموح (Path Traversal)');
  }
  return fullPath;
}

const ALLOWED_UPLOAD_EXT = new Set([
  '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
  '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.json'
]);

const ALLOWED_DOWNLOAD_EXT = new Set([
  ...ALLOWED_UPLOAD_EXT, '.html', '.csv', '.xlsx'
]);

function isAllowedUpload(filename) {
  return ALLOWED_UPLOAD_EXT.has(path.extname(filename).toLowerCase());
}

function isAllowedDownload(filename) {
  return ALLOWED_DOWNLOAD_EXT.has(path.extname(filename).toLowerCase());
}

module.exports = { resolveSafePath, isAllowedUpload, isAllowedDownload, ALLOWED_UPLOAD_EXT };

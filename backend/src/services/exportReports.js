const fs = require('fs-extra');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');
const PDFDocument = require('pdfkit');

async function exportToWord(content, outputPath, options = {}) {
  const { title = 'تقرير قانوني', caseNumber = '', date = new Date().toLocaleDateString('ar-BH') } = options;
  const lines = content.split(/\r?\n/);
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, bidirectional: true }),
    new Paragraph({ children: [new TextRun({ text: `رقم القضية: ${caseNumber}`, rightToLeft: true })], alignment: AlignmentType.RIGHT }),
    new Paragraph({ children: [new TextRun({ text: `التاريخ: ${date}`, rightToLeft: true })], alignment: AlignmentType.RIGHT, spacing: { after: 400 } }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1e40af' } }, spacing: { after: 300 } })
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { children.push(new Paragraph({ text: '' })); continue; }
    if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        text: trimmed.replace(/^#+\s*/, ''),
        heading: trimmed.startsWith('## ') ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        bidirectional: true, alignment: AlignmentType.RIGHT
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, rightToLeft: true, size: 24 })],
        alignment: AlignmentType.RIGHT, bidirectional: true, spacing: { after: 120 }
      }));
    }
  }
  children.push(
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({
        text: '— هذا المستند مُنتج بمساعدة نظام ذكاء اصطناعي ويحتاج مراجعة محامٍ مرخص قبل الاعتماد عليه —',
        italics: true, size: 18, color: '666666', rightToLeft: true
      })],
      alignment: AlignmentType.CENTER
    })
  );
  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }]
  });
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function exportToPdf(content, outputPath, options = {}) {
  const { title = 'Legal Report', caseNumber = '', date = new Date().toISOString().slice(0, 10) } = options;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Case: ${caseNumber}  |  Date: ${date}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1e40af');
    doc.moveDown();
    doc.fontSize(11);
    for (const line of content.split(/\r?\n/)) {
      if (doc.y > 750) doc.addPage();
      doc.text(line || ' ', { align: 'left' });
    }
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#666666')
      .text('Generated with AI assistance – requires licensed lawyer review in Bahrain', { align: 'center' });
    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

async function exportReport(sourcePath, outputDir, meta = {}) {
  const content = await fs.readFile(sourcePath, 'utf8');
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const stamp = new Date().toISOString().slice(0, 10);
  const wordPath = path.join(outputDir, `${baseName}-${stamp}.docx`);
  const pdfPath = path.join(outputDir, `${baseName}-${stamp}.pdf`);
  await exportToWord(content, wordPath, { title: meta.title || baseName, caseNumber: meta.caseNumber || '', date: stamp });
  await exportToPdf(content, pdfPath, { title: meta.title || baseName, caseNumber: meta.caseNumber || '', date: stamp });
  return { word: wordPath, pdf: pdfPath };
}

module.exports = { exportToWord, exportToPdf, exportReport };

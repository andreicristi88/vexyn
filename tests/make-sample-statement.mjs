// Builds a minimal, uncompressed bank-statement PDF so the whole chain
// (pdf.js -> line rebuilding -> table) can be exercised before real statements
// arrive. Debit/credit/balance layout, a wrapped description, and a footer.
import { writeFileSync } from 'node:fs';

// Helvetica advance widths (/1000 em) for the glyphs we use.
const W = { d: 556, dot: 278, comma: 278, minus: 333, space: 278, upper: 667, lower: 500 };
const SIZE = 10;
function widthOf(s) {
  let w = 0;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') w += W.d;
    else if (ch === '.') w += W.dot;
    else if (ch === ',') w += W.comma;
    else if (ch === '-') w += W.minus;
    else if (ch === ' ') w += W.space;
    else if (ch >= 'A' && ch <= 'Z') w += W.upper;
    else w += W.lower;
  }
  return (w / 1000) * SIZE;
}

const draw = [];
const at = (s, x, y) => draw.push({ s, x, y });
/** Right-aligned, the way statements print money. */
const right = (s, r, y) => draw.push({ s, x: r - widthOf(s), y });

// Header (no date -> must be ignored by the parser)
at('ACME BANK — Statement of account', 50, 800);
at('Date', 50, 770);
at('Description', 110, 770);
right('Debit', 400, 770);
right('Credit', 470, 770);
right('Balance', 545, 770);

// Transactions
at('02/03/2026', 50, 750); at('CARD PURCHASE MERCHANT', 110, 750);
right('25.00', 400, 750); right('975.00', 545, 750);
at('CONTACTLESS LONDON', 112, 738); // wrapped description

at('03/03/2026', 50, 720); at('SALARY MARCH', 110, 720);
right('2,500.00', 470, 720); right('3,475.00', 545, 720);

at('04/03/2026', 50, 700); at('ATM WITHDRAWAL', 110, 700);
right('100.00', 400, 700); right('3,375.00', 545, 700);

at('05/03/2026', 50, 680); at('DIRECT DEBIT UTILITIES', 110, 680);
right('64.20', 400, 680); right('3,310.80', 545, 680);

// Footer (centred, far below -> must not be glued onto the last description)
at('Page 1 of 1', 260, 60);

const content =
  draw.map((d) => `BT /F1 ${SIZE} Tf ${d.x.toFixed(2)} ${d.y.toFixed(2)} Td (${d.s.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n') + '\n';

const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefAt = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

const out = process.argv[2] || 'dist/sample-statement.pdf';
writeFileSync(out, pdf, 'latin1');
console.log('wrote', out, Buffer.byteLength(pdf), 'bytes,', draw.length, 'text runs');

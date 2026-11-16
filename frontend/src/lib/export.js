/**
 * Excel export (ExcelJS, loaded only when used) and print / PDF.
 *
 * PDF uses the browser's print dialog ("Save as PDF"), which renders Marathi names correctly —
 * JS PDF libraries need embedded Devanagari fonts. The look of the page lives in the print
 * stylesheet (index.css) and <PrintHeader>.
 */
import { t } from '../i18n';

// Same blue as the app's brand (buttons, headings).
const BRAND = 'FF1D3FBF';
const BRAND_SOFT = 'FFE8EEFF';
const INK = 'FF0F172A';
const MUTED = 'FF64748B';
const LINE = 'FFE2E8F0';
const ZEBRA = 'FFF8FAFC';

// Fields that hold rupees (everything else numeric is a plain count). A column can say type: 'money' itself.
const MONEY_KEY = /^(amount|paid|udhari|payments?|pending(_amount)?|cash|entry_cash|payments_cash|upi|bank|expenses|net_cash|sales|jar_sales|bottle_sales|profit|collected|balance|deposit_balance|deposit|total)$/;
const MONEY_FMT = '"₹"#,##0.00;[Red]-"₹"#,##0.00';
const INT_FMT = '#,##0';
const thin = { style: 'thin', color: { argb: LINE } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

/** The value of one cell: the column's own formatter, or the row's field. */
function cellValue(col, row) {
  const v = col.excel ? col.excel(row) : col.value ? col.value(row) : row[col.key];
  return v === undefined || v === null ? '' : v;
}

/** 'money' | 'int' | 'text' — explicit col.type, else guessed from the values (and the field name for money). */
function columnType(col, values) {
  if (col.type) return col.type;
  const filled = values.filter((v) => v !== '');
  if (filled.length === 0 || !filled.every((v) => typeof v === 'number' && Number.isFinite(v))) return 'text';
  return MONEY_KEY.test(col.key || '') ? 'money' : 'int';
}

/** Rough on-screen width of a cell's text, in Excel "characters". */
const width = (v) => String(v ?? '').length;

function today() {
  return new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Builds the styled workbook (also used by the tests): a title block, a coloured header row that is
 * frozen and filterable, banded rows with money / number formats, an optional totals row and a
 * ready-to-print page setup (landscape when wide, header row repeated, page numbers).
 *
 *   columns: [{ label, key | value(row) | excel(row), type?: 'money'|'int'|'text', total?: false }]
 *   titleLines: [business name, report title, ...detail lines]
 *   opts.totals: add a bold totals row for the number columns (a column opts out with total: false).
 */
export function buildWorkbook(ExcelJS, sheetName, columns, rows, titleLines = [], opts = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = titleLines[0] || 'EasyJar';
  wb.created = new Date();
  wb.title = titleLines[1] || sheetName;

  const ws = wb.addWorksheet(sheetName.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), {
    properties: { tabColor: { argb: BRAND } },
    views: [{ showGridLines: false }],
  });

  const body = rows.map((r) => columns.map((c) => cellValue(c, r)));
  const types = columns.map((c, i) => columnType(c, body.map((r) => r[i])));
  const last = Math.max(columns.length, 1);

  // ── Title block ──
  let r = 1;
  const line = (text, font, height) => {
    ws.mergeCells(r, 1, r, last);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    ws.getRow(r).height = height;
    r += 1;
  };
  titleLines.filter(Boolean).forEach((text, i) => {
    if (i === 0) line(text, { name: 'Calibri', size: 18, bold: true, color: { argb: BRAND } }, 28);
    else if (i === 1) line(text, { name: 'Calibri', size: 13, bold: true, color: { argb: INK } }, 22);
    else line(text, { name: 'Calibri', size: 10, color: { argb: MUTED } }, 16);
  });
  line(`${t('export.generated')}: ${today()}`, { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } }, 15);
  // Accent rule under the title block.
  for (let c = 1; c <= last; c++) ws.getCell(r, c).border = { top: { style: 'medium', color: { argb: BRAND } } };
  ws.getRow(r).height = 6;
  r += 1;

  // ── Header row ──
  const headerRow = r;
  columns.forEach((c, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = c.label;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: types[i] === 'text' ? 'left' : 'right', wrapText: true };
    cell.border = box;
  });
  ws.getRow(headerRow).height = 26;
  r += 1;

  // ── Data rows ──
  const firstData = r;
  body.forEach((vals, ri) => {
    vals.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
      cell.border = box;
      cell.alignment = { vertical: 'middle', horizontal: types[i] === 'text' ? 'left' : 'right', wrapText: types[i] === 'text' };
      if (types[i] === 'money') cell.numFmt = MONEY_FMT;
      else if (types[i] === 'int') cell.numFmt = INT_FMT;
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    });
    ws.getRow(r).height = 20;
    r += 1;
  });
  const lastData = r - 1;

  // ── Totals row ──
  if (opts.totals && body.length > 0) {
    columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      const sums = types[i] !== 'text' && c.total !== false;
      cell.value = i === 0 ? t('rep.total') : sums ? { formula: `SUBTOTAL(9,${ws.getCell(firstData, i + 1).address}:${ws.getCell(lastData, i + 1).address})`, result: body.reduce((a, row) => a + (Number(row[i]) || 0), 0) } : '';
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: INK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } };
      cell.border = { top: { style: 'medium', color: { argb: BRAND } }, bottom: thin, left: thin, right: thin };
      cell.alignment = { vertical: 'middle', horizontal: types[i] === 'text' ? 'left' : 'right' };
      if (types[i] === 'money') cell.numFmt = MONEY_FMT;
      else if (types[i] === 'int') cell.numFmt = INT_FMT;
    });
    ws.getRow(r).height = 22;
    r += 1;
  }

  // ── Column widths: widest of the header and the cells (capped) ──
  columns.forEach((c, i) => {
    const cells = body.map((row) => (types[i] === 'money' ? `₹${Number(row[i] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : row[i]));
    const widest = Math.max(width(c.label) + 3, ...cells.map(width));
    ws.getColumn(i + 1).width = Math.min(Math.max(widest + 3, 11), 42);
  });
  // A long title must not widen the first column: it is merged across the table instead.

  // ── Freeze the header, add filters, print setup ──
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  if (body.length > 0) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastData, column: last } };
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    printTitlesRow: `${headerRow}:${headerRow}`,
    horizontalCentered: true,
  };
  const shop = String(titleLines[0] || 'EasyJar').replace(/&/g, '&&');
  ws.headerFooter = { oddFooter: `&L&8&K64748B${shop}&R&8&K64748BPage &P of &N` };

  return wb;
}

/** Downloads a styled .xlsx. Same call as before; `opts` is optional (see buildWorkbook). */
export async function exportExcel(filename, sheetName, columns, rows, titleLines = [], opts = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = buildWorkbook(ExcelJS, sheetName, columns, rows, titleLines, opts);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Opens the print dialog (choose "Save as PDF") for a report: A4 with a footer showing the shop name
 * and "Page X of Y". `landscape` is for wide tables. The page style is added just for this print
 * and removed afterwards, so customer bills (which call window.print() themselves) are not touched.
 */
export function printPage({ landscape = false, footer = '' } = {}) {
  const shop = String(footer).replace(/["\\]/g, '');
  const style = document.createElement('style');
  style.textContent = `@page { size: A4${landscape ? ' landscape' : ''}; margin: 14mm 12mm 16mm;
    @bottom-left { content: "${shop}"; font: 8px/1 system-ui, sans-serif; color: #94a3b8; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px/1 system-ui, sans-serif; color: #64748b; } }`;
  document.head.appendChild(style);
  const done = () => {
    style.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

/**
 * Excel export (SheetJS, loaded only when used) and print / PDF.
 * PDF uses the browser's print dialog ("Save as PDF"), which renders Marathi
 * names correctly — JS PDF libraries need embedded Devanagari fonts.
 */
export async function exportExcel(filename, sheetName, columns, rows, titleLines = []) {
  const XLSX = await import('xlsx');
  const aoa = [
    ...titleLines.map((t) => [t]),
    ...(titleLines.length ? [[]] : []),
    columns.map((c) => c.label),
    ...rows.map((r) => columns.map((c) => (c.excel ? c.excel(r) : c.value ? c.value(r) : r[c.key]))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(10, String(c.label).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function printPage() {
  window.print();
}

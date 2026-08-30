export function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') { field += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { row.push(field); field = ''; continue; }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      continue;
    }
    field += character;
  }
  if (quoted) throw new Error('CSV possui aspas não fechadas.');
  row.push(field);
  if (row.some((value) => value.length)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])));
}

export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '\uFEFF';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `\uFEFF${headers.map(csvCell).join(',')}\r\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}`;
}

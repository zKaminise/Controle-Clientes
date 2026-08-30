import { describe, expect, it } from 'vitest';
import { csvCell, parseCsv, toCsv } from '@/lib/csv';

describe('CSV portability', () => {
  it('parses quoted commas and escaped quotes', () => expect(parseCsv('name,notes\r\n"Acme, Ltd","Disse ""sim"""')).toEqual([{ name: 'Acme, Ltd', notes: 'Disse "sim"' }]));
  it('neutralizes spreadsheet formulas', () => expect(csvCell('=WEBSERVICE("x")')).toContain("'=WEBSERVICE"));
  it('adds a UTF-8 BOM for Excel', () => expect(toCsv([{ name: 'João' }]).startsWith('\uFEFF')).toBe(true));
});

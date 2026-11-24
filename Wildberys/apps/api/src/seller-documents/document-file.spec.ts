import { describe, expect, it } from 'vitest';

import { documentContentType, tidyFileName } from './document-file.js';

describe('documentContentType', () => {
  it.each([
    ['a PDF', '%PDF-1.7 rest of the file', 'application/pdf'],
    ['a JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg'],
    ['a PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), 'image/png'],
  ])('knows %s by its first bytes', (_what, file, contentType) => {
    expect(documentContentType(Buffer.from(file))).toBe(contentType);
  });

  it.each([
    ['a text', 'Hello'],
    ['a web page', '<html><script>alert(1)</script></html>'],
    ['a program', Buffer.from([0x4d, 0x5a, 0x90, 0x00])],
    ['an empty file', ''],
    ['a file that only starts like a PDF', '%PD'],
  ])('refuses %s', (_what, file) => {
    expect(documentContentType(Buffer.from(file))).toBeUndefined();
  });
});

describe('tidyFileName', () => {
  it.each([
    ['Výpis z rejstříku.pdf', 'Výpis z rejstříku.pdf'],
    ['  pas.jpg  ', 'pas.jpg'],
    ['C:\\Users\\jana\\Documents\\pas.jpg', 'pas.jpg'],
    ['../../etc/passwd', 'passwd'],
    ['scan\u0000\n.pdf', 'scan.pdf'],
  ])('keeps %s as %s', (name, kept) => {
    expect(tidyFileName(name)).toBe(kept);
  });

  it('cuts a very long name', () => {
    expect(tidyFileName('a'.repeat(300))).toHaveLength(120);
  });
});

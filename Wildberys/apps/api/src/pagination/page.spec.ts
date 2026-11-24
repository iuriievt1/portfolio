import { describe, expect, it } from 'vitest';

import { toPage } from './page.js';

const rows = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];

describe('toPage', () => {
  it('returns a full page and the cursor of its last item when another page exists', () => {
    expect(toPage(rows, 2)).toEqual({ items: [{ id: 'c' }, { id: 'b' }], nextCursor: 'b' });
  });

  it('returns no cursor on the last page', () => {
    expect(toPage(rows, 3)).toEqual({ items: rows, nextCursor: null });
    expect(toPage(rows, 10)).toEqual({ items: rows, nextCursor: null });
  });

  it('returns an empty page when there is nothing', () => {
    expect(toPage([], 10)).toEqual({ items: [], nextCursor: null });
  });
});

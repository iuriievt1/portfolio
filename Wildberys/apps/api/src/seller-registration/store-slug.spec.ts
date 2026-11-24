import { describe, expect, it } from 'vitest';

import { toStoreSlug } from './store-slug.js';

describe('toStoreSlug', () => {
  it.each([
    ['Studio Lila', 'studio-lila'],
    ['Čokoláda & Káva', 'cokolada-kava'],
    ['Žluťoučký kůň', 'zlutoucky-kun'],
    ['  Móda 24  ', 'moda-24'],
    ['A.B.C. Shop!', 'a-b-c-shop'],
    ['studio-lila', 'studio-lila'],
  ])('turns "%s" into "%s"', (name, slug) => {
    expect(toStoreSlug(name)).toBe(slug);
  });

  it('gives nothing for a name without Latin letters or digits', () => {
    expect(toStoreSlug('★ ♥ ★')).toBe('');
  });
});

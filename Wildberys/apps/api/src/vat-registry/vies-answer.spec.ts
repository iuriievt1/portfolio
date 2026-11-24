import { describe, expect, it } from 'vitest';

import { readViesAnswer } from './vies-answer.js';

/** An answer in the shape VIES gives for a number that is valid. */
const allegro = {
  isValid: true,
  requestDate: '2026-11-17T22:23:01.531Z',
  userError: 'VALID',
  name: 'ALLEGRO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  address: 'WIERZBIĘCICE 1B\n61-569 POZNAŃ',
  requestIdentifier: '',
  originalVatNumber: '5252674798',
  vatNumber: '5252674798',
};

describe('readViesAnswer', () => {
  it('reads a valid number with its name and its address in one line', () => {
    expect(readViesAnswer('PL', allegro)).toEqual({
      status: 'valid',
      record: {
        vatNumber: 'PL5252674798',
        name: 'ALLEGRO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        address: 'WIERZBIĘCICE 1B, 61-569 POZNAŃ',
      },
    });
  });

  it('tidies the spaces and the empty lines of an address', () => {
    const padded = { ...allegro, address: 'PIAZZALE ENRICO MATTEI 1 \n00144   ROMA RM\n' };

    expect(readViesAnswer('IT', padded)).toMatchObject({
      record: { address: 'PIAZZALE ENRICO MATTEI 1, 00144 ROMA RM' },
    });
  });

  it('has no name and no address when the country does not share them', () => {
    const notShared = { ...allegro, name: '---', address: '---', vatNumber: 'A28015865' };

    expect(readViesAnswer('ES', notShared)).toEqual({
      status: 'valid',
      record: { vatNumber: 'ESA28015865', name: null, address: null },
    });
  });

  it('writes a Greek number with the letters VIES was asked with', () => {
    expect(readViesAnswer('EL', { ...allegro, vatNumber: '094014201' })).toMatchObject({
      record: { vatNumber: 'EL094014201' },
    });
  });

  it.each(['INVALID', 'INVALID_INPUT'])('says a number is not valid for %s', (userError) => {
    expect(readViesAnswer('PL', { ...allegro, isValid: false, userError })).toEqual({
      status: 'invalid',
    });
  });

  it.each([
    [
      'a country whose register is closed',
      { ...allegro, isValid: false, userError: 'MS_UNAVAILABLE' },
    ],
    ['a busy service', { ...allegro, isValid: false, userError: 'GLOBAL_MAX_CONCURRENT_REQ' }],
    ['a yes without a number', { ...allegro, vatNumber: '' }],
    ['a yes that says no', { ...allegro, isValid: false }],
    ['a text', 'Service Unavailable'],
    ['nothing', null],
  ])('counts %s as no answer', (_what, answer) => {
    expect(readViesAnswer('PL', answer)).toEqual({ status: 'unavailable' });
  });
});

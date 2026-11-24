import { describe, expect, it } from 'vitest';

import { coversRetail, toRegistryTrades } from './ares-trades.js';

/** An answer in the shape ARES gives for the trade licences of one company. */
const answer = {
  icoId: '27082440',
  zaznamy: [
    {
      ico: '27082440',
      zivnosti: [
        {
          datumVzniku: '2003-08-26',
          predmetPodnikani:
            'Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona',
          druhZivnosti: 'L',
          oboryCinnosti: [
            { platnostOd: '2003-08-26', oborNazev: 'Velkoobchod a maloobchod' },
            { platnostOd: '2003-08-26', platnostDo: '2010-01-01', oborNazev: 'Reklamní činnost' },
          ],
        },
        {
          datumVzniku: '2014-10-29',
          predmetPodnikani: 'Hostinská činnost',
          druhZivnosti: 'R',
          odpovedniZastupci: [{ jmeno: 'Jana', prijmeni: 'Nováková', datumNarozeni: '1986-10-30' }],
        },
        {
          datumVzniku: '2011-01-01',
          datumZaniku: '2017-03-01',
          predmetPodnikani: 'Zprostředkování spotřebitelského úvěru',
          druhZivnosti: 'V',
        },
        {
          datumVzniku: '2015-06-10',
          predmetPodnikani: 'Silniční motorová doprava',
          druhZivnosti: 'K',
        },
      ],
    },
  ],
};

describe('toRegistryTrades', () => {
  it('reads the licences that hold now, with the fields of a free trade that still hold', () => {
    expect(toRegistryTrades(answer)).toEqual([
      {
        name: 'Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona',
        kind: 'FREE',
        since: '2003-08-26',
        fields: ['Velkoobchod a maloobchod'],
      },
      { name: 'Hostinská činnost', kind: 'CRAFT', since: '2014-10-29', fields: [] },
      { name: 'Silniční motorová doprava', kind: 'CONCESSION', since: '2015-06-10', fields: [] },
    ]);
  });

  it('takes nothing about the people the register lists with a licence', () => {
    expect(JSON.stringify(toRegistryTrades(answer))).not.toContain('Nováková');
  });

  it('leaves out a licence of a kind it does not know', () => {
    const strange = {
      zaznamy: [
        { zivnosti: [{ datumVzniku: '2020-01-01', predmetPodnikani: 'X', druhZivnosti: 'Q' }] },
      ],
    };

    expect(toRegistryTrades(strange)).toEqual([]);
  });

  it('has no licences for a company without any', () => {
    expect(toRegistryTrades({ zaznamy: [{ ico: '27082440' }] })).toEqual([]);
  });

  it.each([
    ['a text', 'Service Unavailable'],
    ['nothing', null],
    ['another shape', { kod: 'CHYBA' }],
  ])('does not read %s', (_what, strange) => {
    expect(toRegistryTrades(strange)).toBeUndefined();
  });
});

describe('coversRetail', () => {
  it('finds retail among the fields of a free trade', () => {
    expect(coversRetail(toRegistryTrades(answer) ?? [])).toBe(true);
  });

  it('finds retail in the name of an older licence', () => {
    expect(
      coversRetail([
        { name: 'Specializovaný maloobchod', kind: 'FREE', since: '2001-01-01', fields: [] },
      ]),
    ).toBe(true);
  });

  it('finds none among licences for other things, or without any licence', () => {
    expect(
      coversRetail([{ name: 'Hostinská činnost', kind: 'CRAFT', since: '2014-10-29', fields: [] }]),
    ).toBe(false);
    expect(coversRetail([])).toBe(false);
  });
});

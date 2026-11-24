import { describe, expect, it } from 'vitest';

import { SellerLegalForm } from '../generated/prisma/enums.js';
import { toRegistryCompany } from './ares-record.js';

/** A record in the shape ARES answers with. The company is the sample one of the designs. */
const company = {
  ico: '27082440',
  obchodniJmeno: 'Studio Lila s.r.o.',
  sidlo: {
    kodStatu: 'CZ',
    nazevObce: 'Praha',
    nazevMestskehoObvodu: 'Praha 10',
    nazevCastiObce: 'Vinohrady',
    nazevUlice: 'Korunní',
    cisloDomovni: 2569,
    cisloOrientacni: 108,
    psc: 10100,
    textovaAdresa: 'Korunní 2569/108, Vinohrady, 10100 Praha 10',
  },
  pravniForma: '112',
  dic: 'CZ27082440',
  seznamRegistraci: {
    stavZdrojeRos: 'AKTIVNI',
    stavZdrojeRes: 'AKTIVNI',
    stavZdrojeDph: 'AKTIVNI',
  },
};

const soleTrader = {
  ico: '01016474',
  obchodniJmeno: 'Jana Nováková',
  sidlo: {
    kodStatu: 'CZ',
    nazevObce: 'Mělník',
    nazevCastiObce: 'Mělník',
    nazevUlice: 'Rožkovo údolí',
    cisloDomovni: 2865,
    psc: 27601,
    textovaAdresa: 'Rožkovo údolí 2865, 27601 Mělník',
  },
  pravniForma: '101',
  seznamRegistraci: {
    stavZdrojeRos: 'AKTIVNI',
    stavZdrojeRes: 'AKTIVNI',
    stavZdrojeDph: 'NEEXISTUJICI',
  },
};

describe('toRegistryCompany', () => {
  it('reads a company that pays VAT', () => {
    expect(toRegistryCompany(company)).toEqual({
      ico: '27082440',
      legalName: 'Studio Lila s.r.o.',
      legalForm: SellerLegalForm.COMPANY,
      vatNumber: 'CZ27082440',
      isVatPayer: true,
      isActive: true,
      address: {
        street: 'Korunní 2569/108',
        city: 'Praha 10',
        postalCode: '10100',
        countryCode: 'CZ',
      },
    });
  });

  it('reads a sole trader without a tax number', () => {
    expect(toRegistryCompany(soleTrader)).toEqual({
      ico: '01016474',
      legalName: 'Jana Nováková',
      legalForm: SellerLegalForm.SOLE_TRADER,
      vatNumber: null,
      isVatPayer: false,
      isActive: true,
      address: {
        street: 'Rožkovo údolí 2865',
        city: 'Mělník',
        postalCode: '27601',
        countryCode: 'CZ',
      },
    });
  });

  it.each(['101', '105', '108'])('takes the legal form %s for a sole trader', (pravniForma) => {
    expect(toRegistryCompany({ ...company, pravniForma })?.legalForm).toBe(
      SellerLegalForm.SOLE_TRADER,
    );
  });

  it.each(['111', '112', '121', '205'])('takes the legal form %s for a company', (pravniForma) => {
    expect(toRegistryCompany({ ...company, pravniForma })?.legalForm).toBe(SellerLegalForm.COMPANY);
  });

  it('tidies the spaces in a name', () => {
    expect(
      toRegistryCompany({ ...company, obchodniJmeno: ' Studio   Lila  s.r.o. ' }),
    ).toMatchObject({ legalName: 'Studio Lila s.r.o.' });
  });

  it('keeps the zero a postal code starts with', () => {
    const record = { ...company, sidlo: { ...company.sidlo, psc: 1234 } };

    expect(toRegistryCompany(record)?.address.postalCode).toBe('01234');
  });

  it('puts the street together when the register gives no ready text', () => {
    const record = { ...company, sidlo: { ...company.sidlo, textovaAdresa: undefined } };

    expect(toRegistryCompany(record)?.address.street).toBe('Korunní 2569/108');
  });

  it('uses the name of the village where there are no streets', () => {
    const record = {
      ...company,
      sidlo: { kodStatu: 'CZ', nazevObce: 'Lhota', cisloDomovni: 12, psc: 25101 },
    };

    expect(toRegistryCompany(record)?.address).toEqual({
      street: 'Lhota 12',
      city: 'Lhota',
      postalCode: '25101',
      countryCode: 'CZ',
    });
  });

  it('says a closed company is not active', () => {
    const record = {
      ...company,
      seznamRegistraci: { stavZdrojeRos: 'NEEXISTUJICI', stavZdrojeRes: 'HISTORICKY' },
    };

    expect(toRegistryCompany(record)).toMatchObject({ isActive: false, isVatPayer: false });
  });

  it.each([
    ['no name', { ...company, obchodniJmeno: undefined }],
    ['no legal form', { ...company, pravniForma: undefined }],
    ['no address', { ...company, sidlo: undefined }],
    [
      'an address without a postal code',
      { ...company, sidlo: { ...company.sidlo, psc: undefined } },
    ],
    ['an answer that is not a record', 'NENALEZENO'],
    ['nothing', undefined],
  ])('gives nothing for %s', (_what, record) => {
    expect(toRegistryCompany(record)).toBeUndefined();
  });
});

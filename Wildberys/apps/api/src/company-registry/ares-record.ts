import { SellerLegalForm } from '../generated/prisma/enums.js';
import type { RegistryAddress, RegistryCompany } from './company-registry.js';

/** In the list of legal forms of ARES the codes 101 to 108 are people who do business under their own name. */
const firstSoleTraderForm = 101;
const lastSoleTraderForm = 108;

const active = 'AKTIVNI';
const postalCodeLength = 5;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A text of the register without the spaces around it and with single spaces inside. */
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const tidy = value.trim().replace(/\s+/g, ' ');

  return tidy.length > 0 ? tidy : undefined;
}

function wholeNumber(value: unknown): string | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? String(value) : undefined;
}

/** The street with the house number, put together from the parts when the register gives no ready text. */
function streetFromParts(seat: JsonObject): string | undefined {
  const houseNumber = wholeNumber(seat.cisloDomovni);
  // A village without street names uses its own name in place of a street.
  const place = text(seat.nazevUlice) ?? text(seat.nazevCastiObce) ?? text(seat.nazevObce);

  if (!houseNumber || !place) {
    return undefined;
  }

  const orientationNumber = wholeNumber(seat.cisloOrientacni);
  const orientation = orientationNumber
    ? `/${orientationNumber}${text(seat.cisloOrientacniPismeno) ?? ''}`
    : '';

  return `${place} ${houseNumber}${orientation}`;
}

function toAddress(seat: unknown): RegistryAddress | undefined {
  if (!isObject(seat)) {
    return undefined;
  }

  // "Jankovcova 1522/53, Holešovice, 17000 Praha 7": the part before the first comma is the street.
  const street = text(text(seat.textovaAdresa)?.split(',')[0]) ?? streetFromParts(seat);
  // Prague is written with its district, the way a letter is addressed: Praha 7.
  const city = text(seat.nazevMestskehoObvodu) ?? text(seat.nazevObce);
  const postalCode = wholeNumber(seat.psc)?.padStart(postalCodeLength, '0');
  const countryCode = text(seat.kodStatu);

  if (!street || !city || !postalCode || !countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
    return undefined;
  }

  return { street, city, postalCode, countryCode };
}

function toLegalForm(code: string): SellerLegalForm {
  const form = Number(code);

  return form >= firstSoleTraderForm && form <= lastSoleTraderForm
    ? SellerLegalForm.SOLE_TRADER
    : SellerLegalForm.COMPANY;
}

/**
 * Reads one record of ARES (GET /ekonomicke-subjekty/{ico}).
 * Undefined when the record lacks something a seller cannot be registered without.
 */
export function toRegistryCompany(record: unknown): RegistryCompany | undefined {
  if (!isObject(record)) {
    return undefined;
  }

  const ico = text(record.ico);
  const legalName = text(record.obchodniJmeno);
  const legalFormCode = text(record.pravniForma);
  const address = toAddress(record.sidlo);

  if (!ico || !legalName || !legalFormCode || !address) {
    return undefined;
  }

  const registrations = isObject(record.seznamRegistraci) ? record.seznamRegistraci : {};

  return {
    ico,
    legalName,
    legalForm: toLegalForm(legalFormCode),
    vatNumber: text(record.dic) ?? null,
    isVatPayer: registrations.stavZdrojeDph === active,
    // The register of persons (ROS) and the statistical register (RES) both list a company that exists.
    isActive: registrations.stavZdrojeRos === active || registrations.stavZdrojeRes === active,
    address,
  };
}

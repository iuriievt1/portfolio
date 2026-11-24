import type { SellerLegalForm } from '@bluberi/api-client';
import { createTabStore } from '@bluberi/ui/tab-store';

import type { StoreLogo } from './logo';

/** An address a code was sent to, and when another code can be asked for. */
export interface SentCode {
  readonly to: string;
  readonly resendAt: number;
}

/** A company from a country other than the home one, as it is typed now. */
export interface TypedCompany {
  /** The person said they have no VAT number, or took the word back. */
  readonly noVatNumber?: boolean;
  /** The VAT number as the person writes it, with or without the letters of the country. */
  readonly vatNumber?: string;
  readonly legalName?: string;
  readonly legalForm?: SellerLegalForm;
  readonly registrationNumber?: string;
  readonly street?: string;
  readonly city?: string;
  readonly postalCode?: string;
}

/** What the register of VAT numbers answered about a number, and which number it was asked about. */
export interface VatCheck {
  readonly countryCode: string;
  /** The number without the letters of its country, as it was sent to the register. */
  readonly number: string;
  /** The number with the letters of its country, as the register writes it. */
  readonly vatNumber: string;
  readonly name: string | null;
  readonly address: string | null;
}

/**
 * What a person typed in the registration and did not save yet. It stays over a reload of the page
 * and a change of language. A code, a password and a bank account number are never kept.
 */
export interface RegistrationDraft {
  readonly email?: string;
  readonly emailCode?: SentCode;
  readonly phone?: string;
  readonly phoneCode?: SentCode;
  /** The person ticked the terms for sellers in this tab. */
  readonly termsAccepted?: boolean;
  /** The country the company is registered in, as it is chosen now. */
  readonly countryCode?: string;
  readonly ico?: string;
  readonly typedCompany?: TypedCompany;
  readonly vatCheck?: VatCheck;
  readonly storeName?: string;
  /** A logo that is uploaded and not saved with the store yet. */
  readonly logo?: StoreLogo;
  /** What the store sells, as it is ticked now. */
  readonly categoryIds?: readonly string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function logo(value: unknown): StoreLogo | undefined {
  return isObject(value) && typeof value.imageId === 'string' && typeof value.url === 'string'
    ? { imageId: value.imageId, url: value.url }
    : undefined;
}

function texts(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : undefined;
}

function textOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function legalForm(value: unknown): SellerLegalForm | undefined {
  return value === 'COMPANY' || value === 'SOLE_TRADER' ? value : undefined;
}

function typedCompany(value: unknown): TypedCompany | undefined {
  return isObject(value)
    ? {
        noVatNumber: typeof value.noVatNumber === 'boolean' ? value.noVatNumber : undefined,
        vatNumber: text(value.vatNumber),
        legalName: text(value.legalName),
        legalForm: legalForm(value.legalForm),
        registrationNumber: text(value.registrationNumber),
        street: text(value.street),
        city: text(value.city),
        postalCode: text(value.postalCode),
      }
    : undefined;
}

function vatCheck(value: unknown): VatCheck | undefined {
  return isObject(value) &&
    typeof value.countryCode === 'string' &&
    typeof value.number === 'string' &&
    typeof value.vatNumber === 'string' &&
    textOrNull(value.name) &&
    textOrNull(value.address)
    ? {
        countryCode: value.countryCode,
        number: value.number,
        vatNumber: value.vatNumber,
        name: value.name,
        address: value.address,
      }
    : undefined;
}

function sentCode(value: unknown): SentCode | undefined {
  return isObject(value) && typeof value.to === 'string' && typeof value.resendAt === 'number'
    ? { to: value.to, resendAt: value.resendAt }
    : undefined;
}

export const registrationDraft = createTabStore<RegistrationDraft>({
  storageKey: 'bluberi-seller-registration',
  toValue: (stored) =>
    isObject(stored)
      ? {
          email: text(stored.email),
          emailCode: sentCode(stored.emailCode),
          phone: text(stored.phone),
          phoneCode: sentCode(stored.phoneCode),
          termsAccepted: stored.termsAccepted === true,
          countryCode: text(stored.countryCode),
          ico: text(stored.ico),
          typedCompany: typedCompany(stored.typedCompany),
          vatCheck: vatCheck(stored.vatCheck),
          storeName: text(stored.storeName),
          logo: logo(stored.logo),
          categoryIds: texts(stored.categoryIds),
        }
      : undefined,
});

const nothingTyped: RegistrationDraft = {};

/** Changes a part of the company typed in this tab, from what is kept now. */
export function typeCompany(change: TypedCompany): void {
  registrationDraft.change((current) => ({
    ...current,
    typedCompany: { ...current?.typedCompany, ...change },
  }));
}

/** The draft of this tab and a way to change a part of it. */
export function useRegistrationDraft(): readonly [
  RegistrationDraft,
  (change: Partial<RegistrationDraft>) => void,
] {
  const draft = registrationDraft.useValue() ?? nothingTyped;

  return [
    draft,
    (change) => {
      // From what is kept now: a change can come late, after an upload, when other fields were typed.
      registrationDraft.change((current) => ({ ...current, ...change }));
    },
  ];
}

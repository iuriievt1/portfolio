'use server';

import {
  companyRegistryFind,
  imagesUpload,
  sellerRegistrationChoosePayoutMethod,
  sellerRegistrationFinishPayoutForm,
  sellerRegistrationAddDocument,
  sellerRegistrationRegisterCompany,
  sellerRegistrationRegisterEuCompany,
  sellerRegistrationRemoveDocument,
  sellerRegistrationResubmit,
  sellerRegistrationSaveBankAccount,
  sellerRegistrationSaveStore,
  sellerRegistrationSubmit,
  vatRegistryFind,
  type CheckedVatNumber,
  type Company,
  type SellerLegalForm,
} from '@bluberi/api-client';
import type { Client } from '@bluberi/api-client/client';
import { done, failure, invalidInput, type ActionResult } from '@bluberi/web-auth/action-result';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { refresh } from 'next/cache';

import { authConfig } from '../auth/config';
import type { PostalAddress } from './address';
import { documentKinds, documentMaxBytes } from './documents';
import { logoMaxBytes, type StoreLogo } from './logo';
import { isVatNumber } from './vat-number';

// What comes from the browser is checked before it is used.

/** The same code the API answers with when nobody is signed in. */
const unauthenticated = { ok: false, code: 'UNAUTHENTICATED' } as const;

/** People type company numbers and bank accounts in groups. The API takes them in one piece. */
function withoutSpaces(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * Runs one step of the registration as the signed-in person. After a step that worked
 * the page is drawn again, so it shows what the API saved.
 */
async function step(
  run: (client: Client) => Promise<{ readonly data?: unknown; readonly error?: unknown }>,
): Promise<ActionResult> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await run(client);

  if (!data) {
    return failure(error);
  }

  refresh();

  return done;
}

/** Reads a company from the public register, so the seller sees it before confirming. */
export async function lookUpCompany(ico: unknown): Promise<ActionResult<Company>> {
  if (typeof ico !== 'string') {
    return invalidInput;
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await companyRegistryFind({ client, path: { ico: withoutSpaces(ico) } });

  return data ? { ok: true, value: data } : failure(error);
}

export async function registerCompany(
  ico: unknown,
  isVatPayer: unknown,
  termsAccepted: unknown,
): Promise<ActionResult> {
  if (typeof ico !== 'string' || typeof isVatPayer !== 'boolean' || termsAccepted !== true) {
    return invalidInput;
  }

  return step((client) =>
    sellerRegistrationRegisterCompany({
      client,
      body: { ico: withoutSpaces(ico), isVatPayer, termsAccepted },
    }),
  );
}

function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value);
}

/** Asks the register of VAT numbers of the EU about a number, so the seller sees the answer before going on. */
export async function checkVatNumber(
  countryCode: unknown,
  number: unknown,
): Promise<ActionResult<CheckedVatNumber>> {
  if (!isCountryCode(countryCode) || typeof number !== 'string' || !isVatNumber(number)) {
    return invalidInput;
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await vatRegistryFind({ client, path: { countryCode, number } });

  return data ? { ok: true, value: data } : failure(error);
}

/** A company from another EU country, as the seller wrote it. */
export interface EuCompanyInput {
  readonly countryCode: string;
  /** Without the letters of the country. Null for a trader who has no VAT number. */
  readonly vatNumber: string | null;
  readonly registrationNumber: string;
  readonly legalName: string;
  readonly legalForm: SellerLegalForm;
  readonly address: PostalAddress;
}

function isPostalAddress(value: unknown): value is PostalAddress {
  return (
    typeof value === 'object' &&
    value !== null &&
    'street' in value &&
    typeof value.street === 'string' &&
    'city' in value &&
    typeof value.city === 'string' &&
    'postalCode' in value &&
    typeof value.postalCode === 'string'
  );
}

function isEuCompany(value: unknown): value is EuCompanyInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'countryCode' in value &&
    isCountryCode(value.countryCode) &&
    'vatNumber' in value &&
    (value.vatNumber === null ||
      (typeof value.vatNumber === 'string' && isVatNumber(value.vatNumber))) &&
    'registrationNumber' in value &&
    typeof value.registrationNumber === 'string' &&
    'legalName' in value &&
    typeof value.legalName === 'string' &&
    'legalForm' in value &&
    (value.legalForm === 'COMPANY' || value.legalForm === 'SOLE_TRADER') &&
    'address' in value &&
    isPostalAddress(value.address)
  );
}

export async function registerEuCompany(
  company: unknown,
  termsAccepted: unknown,
): Promise<ActionResult> {
  if (!isEuCompany(company) || termsAccepted !== true) {
    return invalidInput;
  }

  const { countryCode, vatNumber, registrationNumber, legalName, legalForm, address } = company;

  return step((client) =>
    sellerRegistrationRegisterEuCompany({
      client,
      body: {
        countryCode,
        vatNumber,
        registrationNumber,
        legalName,
        legalForm,
        address: { street: address.street, city: address.city, postalCode: address.postalCode },
        termsAccepted,
      },
    }),
  );
}

export async function choosePayoutMethod(method: unknown): Promise<ActionResult> {
  if (method !== 'STRIPE' && method !== 'BANK') {
    return invalidInput;
  }

  return step((client) => sellerRegistrationChoosePayoutMethod({ client, body: { method } }));
}

export async function saveBankAccount(
  iban: unknown,
  holderName: unknown,
  currency: unknown,
): Promise<ActionResult> {
  if (
    typeof iban !== 'string' ||
    typeof holderName !== 'string' ||
    (currency !== 'CZK' && currency !== 'EUR')
  ) {
    return invalidInput;
  }

  return step((client) =>
    sellerRegistrationSaveBankAccount({
      client,
      body: { iban: withoutSpaces(iban).toUpperCase(), holderName, currency },
    }),
  );
}

/** The seller finished the form of the payment provider. */
export async function finishPayoutForm(): Promise<ActionResult> {
  return step((client) => sellerRegistrationFinishPayoutForm({ client }));
}

/** Adds a document to the registration: before it is sent, or when the team asked for one. */
export async function addDocument(formData: FormData): Promise<ActionResult> {
  const file = formData.get('file');
  const kind = documentKinds.find((candidate) => candidate === formData.get('kind'));

  if (!(file instanceof File) || file.size === 0 || !kind) {
    return invalidInput;
  }

  if (file.size > documentMaxBytes) {
    return { ok: false, code: 'DOCUMENT_TOO_LARGE' };
  }

  return step((client) =>
    sellerRegistrationAddDocument({ client, body: { file, kind, fileName: file.name } }),
  );
}

export async function removeDocument(documentId: unknown): Promise<ActionResult> {
  if (typeof documentId !== 'string') {
    return invalidInput;
  }

  return step((client) => sellerRegistrationRemoveDocument({ client, path: { documentId } }));
}

/** Sends the registration back to the team after the seller answered its request for documents. */
export async function resubmitRegistration(): Promise<ActionResult> {
  return step((client) => sellerRegistrationResubmit({ client }));
}

/** Uploads a picture for the logo of the store. The store takes it when the step is saved. */
export async function uploadLogo(formData: FormData): Promise<ActionResult<StoreLogo>> {
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return invalidInput;
  }

  if (file.size > logoMaxBytes) {
    return { ok: false, code: 'IMAGE_TOO_LARGE' };
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await imagesUpload({ client, body: { file } });
  // The copies come smallest first, and a logo is drawn small.
  const smallest = data?.copies[0];

  return data && smallest
    ? { ok: true, value: { imageId: data.id, url: smallest.url } }
    : failure(error);
}

function isTexts(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * The last step: saves the store and sends the registration to Bluberi, with the promise of the seller
 * to offer only goods that comply with the law of the EU.
 * The return address is an address of its own for returned goods. Null: they come back to the registered one.
 */
export async function finishRegistration(
  name: unknown,
  logoImageId: unknown,
  categoryIds: unknown,
  returnAddress: unknown,
  selfCertified: unknown,
): Promise<ActionResult> {
  if (
    typeof name !== 'string' ||
    (logoImageId !== null && typeof logoImageId !== 'string') ||
    !isTexts(categoryIds) ||
    (returnAddress !== null && !isPostalAddress(returnAddress)) ||
    selfCertified !== true
  ) {
    return invalidInput;
  }

  const saved = await step((client) =>
    sellerRegistrationSaveStore({
      client,
      body: {
        name,
        logoImageId,
        categoryIds,
        returnAddress: returnAddress && {
          street: returnAddress.street,
          city: returnAddress.city,
          postalCode: returnAddress.postalCode,
        },
      },
    }),
  );

  return saved.ok
    ? step((client) => sellerRegistrationSubmit({ client, body: { selfCertified } }))
    : saved;
}

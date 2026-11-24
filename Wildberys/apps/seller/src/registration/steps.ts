import type { RegistrationSeller, SellerRegistration } from '@bluberi/api-client';

import { registrationPath } from '../auth/config';

/** The four steps of the registration, drawn as circles. The names are the keys of their texts. */
export const registrationSteps = ['account', 'company', 'payouts', 'store'] as const;

export type RegistrationStep = (typeof registrationSteps)[number];

/**
 * The pages of the registration in the order a person goes through them.
 * The company step has two: the company itself and its documents.
 */
export const registrationPages = ['account', 'company', 'documents', 'payouts', 'store'] as const;

export type RegistrationPage = (typeof registrationPages)[number];

/** The address of each page, without the language in front. */
export const pagePaths: Record<RegistrationPage, string> = {
  account: registrationPath,
  company: `${registrationPath}/firma`,
  documents: `${registrationPath}/doklady`,
  payouts: `${registrationPath}/platby`,
  store: `${registrationPath}/obchod`,
};

/** The page of an address of the registration. Undefined for any other address. */
export function pageOfPath(path: string): RegistrationPage | undefined {
  return registrationPages.find((page) => pagePaths[page] === path);
}

/** The kinds of documents the registration needs and does not have yet. */
export function missingDocumentKinds({
  requiredDocuments,
  documents,
}: RegistrationSeller): RegistrationSeller['requiredDocuments'] {
  return requiredDocuments.filter((kind) => !documents.some((document) => document.kind === kind));
}

/** The page a person has to finish next. Every page before it is finished and can be opened again. */
export function nextPage({ account, seller }: SellerRegistration): RegistrationPage {
  if (!account.phoneVerified || !account.hasPassword) {
    return 'account';
  }

  if (!seller) {
    return 'company';
  }

  if (missingDocumentKinds(seller).length > 0) {
    return 'documents';
  }

  if (!seller.payoutAccount || seller.payoutAccount.status === 'INCOMPLETE') {
    return 'payouts';
  }

  return 'store';
}

/** True when the person may open this page: it is the next one or one before it. */
export function isOpen(page: RegistrationPage, registration: SellerRegistration): boolean {
  return registrationPages.indexOf(page) <= registrationPages.indexOf(nextPage(registration));
}

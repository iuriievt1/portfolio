import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** A seller account has a password and a confirmed phone number before a company is registered. */
export function accountNotReady(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'ACCOUNT_NOT_READY',
    'Set a password and confirm a phone number first',
  );
}

/** The step needs the company of the seller, and the person has not registered one yet. */
export function companyRequired(): AppException {
  return new AppException(HttpStatus.CONFLICT, 'COMPANY_REQUIRED', 'Register the company first');
}

/** A registration that was sent to Bluberi is not changed through the registration any more. */
export function registrationAlreadySubmitted(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'REGISTRATION_ALREADY_SUBMITTED',
    'The registration is already sent',
  );
}

/** One seller per company: this company number or this VAT number belongs to another seller. */
export function companyAlreadyRegistered(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'COMPANY_ALREADY_REGISTERED',
    'A seller with this company is already registered',
  );
}

/** A payer of VAT has a tax number in the register. */
export function vatNumberMissing(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'VAT_NUMBER_MISSING',
    'The register has no tax number for this company, so it cannot be a payer of VAT',
  );
}

/** The address of a store is made from its name, and this one has nothing an address can be made from. */
export function storeNameInvalid(): AppException {
  return new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'The request is not valid', [
    { field: 'name', message: 'name must have at least two Latin letters or digits' },
  ]);
}

/** Goods come back to an address in the country of the seller, and its postal codes are not written this way. */
export function returnPostalCodeInvalid(): AppException {
  return new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'The request is not valid', [
    {
      field: 'returnAddress.postalCode',
      message: 'returnAddress.postalCode must be a postal code of the country of the seller',
    },
  ]);
}

/** Another store has the address this name gives. */
export function storeNameTaken(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'STORE_NAME_TAKEN',
    'Another store already uses this name',
  );
}

/** The logo is a photo this person uploaded. */
export function logoNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    'IMAGE_NOT_FOUND',
    'No photo with this id was uploaded by this account',
  );
}

/** The registration is sent with the documents its seller has to give. The details name the kinds that are missing. */
export function documentsRequired(missingKinds: readonly string[]): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'DOCUMENTS_REQUIRED',
    'Add the documents the registration needs before sending it',
    missingKinds.map((kind) => ({ field: 'documents', message: `${kind} is missing` })),
  );
}

/** Documents are sent again only after the team asked for them. */
export function documentsNotRequested(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'DOCUMENTS_NOT_REQUESTED',
    'Bluberi did not ask this seller for documents',
  );
}

/** The registration is sent only when the payout form is finished and the store is set up. */
export function registrationIncomplete(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'REGISTRATION_INCOMPLETE',
    'Finish the payouts and the store before sending the registration',
  );
}

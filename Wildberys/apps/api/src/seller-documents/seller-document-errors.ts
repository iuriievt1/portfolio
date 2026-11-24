import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** The request came without a file. */
export function documentRequired(field: string): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    'DOCUMENT_REQUIRED',
    `Send the document in the "${field}" field of a multipart form`,
  );
}

/** The file is not a PDF, a JPEG or a PNG. */
export function documentInvalid(): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    'DOCUMENT_INVALID',
    'The file is not a PDF, a JPEG or a PNG',
  );
}

/** A seller keeps a limited number of documents. An old one has to go first. */
export function documentsLimitReached(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'DOCUMENTS_LIMIT_REACHED',
    'The seller has as many documents as one seller can keep',
  );
}

/** This seller has no document with this id. */
export function documentNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    'DOCUMENT_NOT_FOUND',
    'The seller has no document with this id',
  );
}

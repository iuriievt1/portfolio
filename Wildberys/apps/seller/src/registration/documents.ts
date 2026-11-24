import type { SellerDocumentKind } from '@bluberi/api-client';

/** The largest file the API takes as a document. */
export const documentMaxBytes = 10 * 1024 * 1024;

/** What the file picker offers: the formats the API takes. */
export const documentFormats = 'application/pdf,image/jpeg,image/png';

/** Every kind of document a seller can give, in the order they are shown. */
export const documentKinds = [
  'IDENTITY_DOCUMENT',
  'REGISTER_EXTRACT',
  'OTHER',
] as const satisfies readonly SellerDocumentKind[];

/** The size of a file the way people read it: 184 kB, 2,4 MB. */
export function fileSize(bytes: number, locale: string): string {
  const megabyte = 1024 * 1024;
  const [value, unit] =
    bytes >= megabyte ? [bytes / megabyte, 'megabyte'] : [Math.ceil(bytes / 1024), 'kilobyte'];

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

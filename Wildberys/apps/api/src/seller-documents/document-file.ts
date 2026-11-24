/** The rules of document uploads in one place. */

export const maxDocumentBytes = 10 * 1024 * 1024;

/** How many documents one seller can keep. More than any check needs, it only keeps the storage small. */
export const maxDocumentsPerSeller = 12;

export const fileNameMaxLength = 120;

/** The formats a document can be uploaded in, by the bytes every file of the format starts with. */
const formats = [
  { contentType: 'application/pdf', start: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { contentType: 'image/jpeg', start: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', start: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
] as const;

export type DocumentContentType = (typeof formats)[number]['contentType'];

/**
 * What a file is, read from the file itself: the name and the type a browser sends say nothing sure.
 * Undefined for a file that is not a PDF, a JPEG or a PNG.
 */
export function documentContentType(file: Buffer): DocumentContentType | undefined {
  return formats.find(({ start }) => start.every((byte, index) => file[index] === byte))
    ?.contentType;
}

/**
 * The name of a file as it is kept and shown: without a folder in front of it
 * and without characters that do not print.
 */
export function tidyFileName(name: string): string {
  const withoutFolder = name.split(/[/\\]/).at(-1) ?? '';

  return withoutFolder
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, fileNameMaxLength);
}

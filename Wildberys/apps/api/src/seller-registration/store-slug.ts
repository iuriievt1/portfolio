/** A store address needs at least this many letters or digits to tell stores apart. */
export const storeSlugMinLength = 2;

/**
 * The address of a store made from its name: "Studio Lila" becomes "studio-lila",
 * "Čokoláda & Káva" becomes "cokolada-kava". Only small Latin letters, digits and dashes are kept.
 */
export function toStoreSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

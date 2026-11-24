/**
 * The sections of the seller portal, in the order of the menu in design 02, with the messages
 * the project owner added after it. The names are the URLs: each section has a page in app/[locale]/(portal).
 */
export const mainSections = [
  'prehled',
  'zpravy',
  'objednavky',
  'produkty',
  'import',
  'finance',
  'vraceni',
  'hodnoceni',
  'propagace',
  'analytika',
] as const;

/** The sections under "Nastavení". */
export const settingsSections = ['obchod', 'tym', 'napoveda'] as const;

export type Section = (typeof mainSections)[number] | (typeof settingsSections)[number];

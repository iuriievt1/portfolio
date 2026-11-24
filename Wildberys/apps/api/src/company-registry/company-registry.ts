import type { SellerLegalForm } from '../generated/prisma/enums.js';

export interface RegistryAddress {
  readonly street: string;
  readonly city: string;
  readonly postalCode: string;
  /** ISO 3166-1 alpha-2. */
  readonly countryCode: string;
}

/** What the public register says about a company or a sole trader. */
export interface RegistryCompany {
  /** The company number (IČO). */
  readonly ico: string;
  readonly legalName: string;
  readonly legalForm: SellerLegalForm;
  /** The tax number (DIČ). Null when the register has none. */
  readonly vatNumber: string | null;
  /** Listed as a payer of VAT. */
  readonly isVatPayer: boolean;
  /** False for a company that was closed. */
  readonly isActive: boolean;
  /** The registered address. */
  readonly address: RegistryAddress;
}

/** The kinds of trade licences the Czech law knows, from the one anybody can announce to the one the state grants. */
export const tradeKinds = ['FREE', 'CRAFT', 'PROFESSIONAL', 'CONCESSION'] as const;

export type TradeKind = (typeof tradeKinds)[number];

/** A trade licence a company holds now. */
export interface RegistryTrade {
  /** What the licence allows, in the words of the register. */
  readonly name: string;
  readonly kind: TradeKind;
  /** The day the licence started, as a date: 2003-08-26. */
  readonly since: string;
  /** The fields of a free trade the company announced, like "Velkoobchod a maloobchod". */
  readonly fields: readonly string[];
}

/**
 * The public register of companies. The rest of the API depends on this class,
 * not on the register of one country.
 */
export abstract class CompanyRegistry {
  /** The company with this number, or null when the register has none. */
  abstract find(ico: string): Promise<RegistryCompany | null>;

  /**
   * The trade licences the company holds now. Null when the trade register has no record of it:
   * a company can do business under another law than the trade one.
   */
  abstract trades(ico: string): Promise<RegistryTrade[] | null>;
}

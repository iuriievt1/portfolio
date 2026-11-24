import { SellerDocumentKind } from '../generated/prisma/enums.js';
import { homeCountry } from './seller-countries.js';

/**
 * The documents a seller gives before the registration is sent. Everybody shows who they are.
 * A company from another country also shows its record in the register of its country:
 * no register Bluberi reads confirms its registration number and its address.
 */
export function requiredDocumentKinds(countryCode: string): SellerDocumentKind[] {
  return countryCode === homeCountry
    ? [SellerDocumentKind.IDENTITY_DOCUMENT]
    : [SellerDocumentKind.IDENTITY_DOCUMENT, SellerDocumentKind.REGISTER_EXTRACT];
}

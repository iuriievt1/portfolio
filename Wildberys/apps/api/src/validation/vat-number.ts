/**
 * A VAT number of an EU country without the letters of the country: capital letters and digits.
 * Old Irish numbers also have a plus or a star. The register says whether the number exists.
 */
export const vatNumberPattern = /^[0-9A-Z+*]{2,12}$/;

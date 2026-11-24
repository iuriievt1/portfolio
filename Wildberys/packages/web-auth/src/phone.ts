/** Czechia is the first market, so a phone field starts with its calling code. */
export const phoneStart = '+420 ';

/** Czech and Slovak numbers the way people write them: +420 777 123 456. Other numbers stay as they are. */
export function formatPhone(phone: string): string {
  const parts = /^(\+42[01])(\d{3})(\d{3})(\d{3})$/.exec(phone);

  return parts ? parts.slice(1).join(' ') : phone;
}

/** People type a phone number with spaces, dashes and brackets. The API takes digits after a plus. */
export function withoutSeparators(phone: string): string {
  return phone.replace(/[\s()-]/g, '');
}

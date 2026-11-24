/** The path of the privacy policy in the store. It is the same in every language of the store. */
const privacyPolicyPath = '/ochrana-osobnich-udaju';

/** The address of the store, without a slash at the end. Read on a request, not when the app is built. */
function storeUrl(): string {
  const url = process.env.STORE_URL;

  if (!url || url.endsWith('/')) {
    throw new Error(
      'STORE_URL must be set, without a slash at the end. See apps/seller/.env.example',
    );
  }

  return url;
}

/** The privacy policy of Bluberi is a page of the store. Czech lives on /, English on /en. */
export function privacyPolicyUrl(locale: string): string {
  return `${storeUrl()}${locale === 'en' ? '/en' : ''}${privacyPolicyPath}`;
}

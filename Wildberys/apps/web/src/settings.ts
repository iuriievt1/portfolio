import { createWebAuthConfig, type WebAuthConfig } from '@bluberi/web-auth/config';

let config: WebAuthConfig | undefined;

/** Read on the first request, not when the app is built: the build has no settings. */
export function apiConfig(): WebAuthConfig {
  config ??= createWebAuthConfig('web');

  return config;
}

/**
 * The public address of the store, without a slash at the end. Search engines and social networks
 * need full addresses, and the pages are drawn when the app is built, so the build reads it too.
 */
export function siteUrl(): string {
  const url = process.env.SITE_URL;

  if (!url) {
    throw new Error('SITE_URL is not set. Copy apps/web/.env.example to apps/web/.env');
  }

  if (url.endsWith('/')) {
    throw new Error('SITE_URL must not end with a slash');
  }

  return url;
}

/** The id of a Google Analytics property: "G-" and letters or digits. */
const analyticsIdPattern = /^G-[A-Z0-9]{4,}$/;

/**
 * The id of the Google Analytics property that measures the visits. Without it the store
 * measures nothing and asks nobody for consent. It is written into the pages, so the build
 * reads it, like the address of the site.
 */
export function analyticsId(): string | undefined {
  const id = process.env.GOOGLE_ANALYTICS_ID;

  if (!id) {
    return undefined;
  }

  if (!analyticsIdPattern.test(id)) {
    throw new Error('GOOGLE_ANALYTICS_ID must look like G-XXXXXXXXXX');
  }

  return id;
}

/** Address of the seller portal. The links for sellers lead there. */
export function sellerPortalUrl(): string {
  const url = process.env.SELLER_URL;

  if (!url) {
    throw new Error('SELLER_URL is not set. Copy apps/web/.env.example to apps/web/.env');
  }

  return url;
}

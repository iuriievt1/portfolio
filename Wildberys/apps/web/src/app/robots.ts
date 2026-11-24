import type { MetadataRoute } from 'next';

import { siteUrl } from '../settings';

/** What search engines may read: everything. It also tells them where the list of pages is. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

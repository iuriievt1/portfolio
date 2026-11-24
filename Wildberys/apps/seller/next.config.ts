import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  agentRules: false,
  cacheComponents: true,
  experimental: {
    // A seller uploads files through server actions: the logo of the store and documents of up to 10 MB.
    serverActions: { bodySizeLimit: '11mb' },
  },
  partialPrefetching: true,
  transpilePackages: ['@bluberi/i18n', '@bluberi/ui'],
  typedRoutes: true,
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

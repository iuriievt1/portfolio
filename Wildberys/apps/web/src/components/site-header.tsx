import { buttonClasses } from '@bluberi/ui/components/button';
import { Logo } from '@bluberi/ui/components/logo';
import { useLocale, useTranslations } from 'next-intl';

import { getPathname, Link } from '../i18n/navigation';
import { anchors } from './landing/anchors';
import { LanguageSwitcher } from './language-switcher';
import { container } from './layout';
import { SellerRegistrationLink } from './seller-registration-link';

const blocks = ['categories', 'products', 'delivery', 'app'] as const;

/**
 * The top of every page of the store: the logo, which leads home, the blocks of the landing
 * page, the language and the two ways in, for a buyer and for a seller. It stays on the screen
 * while the page scrolls, so the way into the store is always one tap away.
 */
export function SiteHeader() {
  const t = useTranslations('site');
  const locale = useLocale();
  // The blocks are on the landing page. From another page the links go there first.
  const home = getPathname({ href: '/', locale });
  const block = (anchor: string): string => `${home}#${anchor}`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/85 backdrop-blur-md">
      <div className={`flex h-15 items-center gap-3 lg:h-19 lg:gap-9 ${container}`}>
        <Link
          href="/"
          className="rounded-xs outline-none focus-visible:ring-4 focus-visible:ring-berry-500/14"
        >
          <Logo className="text-[25px] lg:text-[29px]" />
        </Link>
        <nav aria-label={t('menu')} className="flex gap-7 max-xl:hidden">
          {blocks.map((key) => (
            <a
              key={key}
              href={block(anchors[key])}
              className="rounded-xs text-[15px] font-semibold text-gray-700 transition-colors outline-none hover:text-berry-600 focus-visible:ring-4 focus-visible:ring-berry-500/14"
            >
              {t(`nav.${key}`)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5 lg:gap-3">
          <LanguageSwitcher label={t('language')} />
          <SellerRegistrationLink
            className={`max-md:hidden ${buttonClasses({ variant: 'outline', pill: true })}`}
          >
            {t('actions.sell')}
          </SellerRegistrationLink>
          <a
            href={block(anchors.products)}
            className={`max-sm:h-9.5 max-sm:px-4 max-sm:text-sm ${buttonClasses({ pill: true })}`}
          >
            {t('actions.shop')}
          </a>
        </div>
      </div>
    </header>
  );
}

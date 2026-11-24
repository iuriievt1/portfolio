import { buttonClasses } from '@bluberi/ui/components/button';
import { ArrowRightIcon } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';

import { container } from '../layout';
import { SellerRegistrationLink } from '../seller-registration-link';
import { anchors } from './anchors';
import { HeroPhone, HeroVisual } from './hero-visual';

/** On a tablet held upright the two buttons are smaller, so they stand in one row. */
const smallerOnTablet = 'md:max-lg:h-12 md:max-lg:px-4.5 md:max-lg:text-[15px]';

/**
 * The first screen: what Bluberi is, the two ways in, for a buyer and for a seller,
 * and the app in a phone. A tablet and a computer show two phones next to the text,
 * a phone shows one under it.
 */
export function Hero() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden bg-hero-phone md:bg-hero md:pb-8 lg:pb-12 xl:pb-16">
      <div
        className={`md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 lg:gap-10 ${container}`}
      >
        {/* The title and the sentence under it are as large as one line of this column allows. */}
        <div className="@container pt-9 md:py-14 lg:py-20">
          <h1 className="text-[clamp(1.875rem,10.2cqw,2.75rem)] leading-[1.08] font-bold tracking-[-0.03em] md:text-[clamp(2.125rem,10.2cqw,3.75rem)]">
            {t('landing.hero.claim.first')}
            <br />
            <span className="relative z-0 whitespace-nowrap text-berry-500 after:absolute after:-right-[0.06em] after:bottom-[0.08em] after:-left-[0.04em] after:-z-1 after:h-[0.16em] after:rounded-full after:bg-pink-200">
              {t('landing.hero.claim.accent')}
            </span>
          </h1>
          <p className="mt-4 text-[clamp(1rem,5.4cqw,1.25rem)] leading-[1.5] font-medium text-balance text-gray-600 lg:mt-5">
            {t('landing.hero.lead')}
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:mt-8 lg:gap-3">
            <a
              href={`#${anchors.products}`}
              className={`${smallerOnTablet} ${buttonClasses({ size: 'lg', pill: true })}`}
            >
              {t('site.actions.shop')}
              <ArrowRightIcon weight="bold" />
            </a>
            <SellerRegistrationLink
              className={`${smallerOnTablet} ${buttonClasses({ size: 'lg', variant: 'outline', pill: true })}`}
            >
              {t('site.actions.sell')}
            </SellerRegistrationLink>
          </div>
        </div>
        <HeroPhone className="mt-9 md:hidden" />
        <HeroVisual className="relative max-md:hidden md:[zoom:0.46] lg:[zoom:0.66] xl:[zoom:0.84] 2xl:[zoom:0.94]" />
      </div>
    </section>
  );
}

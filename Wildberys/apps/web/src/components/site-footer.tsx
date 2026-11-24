import { operator } from '@bluberi/i18n/operator';
import { Logo } from '@bluberi/ui/components/logo';
import { useLocale, useTranslations } from 'next-intl';

import { getPathname, Link } from '../i18n/navigation';
import { subscribe } from '../newsletter/actions';
import { privacyPolicyPath, unsubscribePath } from '../paths';
import { analyticsId } from '../settings';
import { CookieSettingsButton } from './cookie-consent';
import { anchors } from './landing/anchors';
import { container } from './layout';
import { NewsletterForm } from './newsletter-form';
import { SellerRegistrationLink } from './seller-registration-link';
import { StoreButtons } from './store-buttons';

const payments = ['visa', 'mastercard', 'applePay', 'googlePay'] as const;
const shoppingBlocks = ['categories', 'products', 'delivery', 'app'] as const;

const focusRing = 'rounded-xs outline-none focus-visible:ring-4 focus-visible:ring-white/20';
const columnTitle = 'text-xs font-bold tracking-[0.1em] text-white/45 uppercase';
const columnLink = `text-[15px] font-medium whitespace-nowrap text-white/80 transition-colors hover:text-white ${focusRing}`;
const columnLinks = 'mt-4 flex flex-col items-start gap-3';

/**
 * The bottom of every page of the store: what Bluberi is and where to get the app, the links,
 * the sign-up for news by email and who runs the store.
 */
export function SiteFooter() {
  const t = useTranslations();
  const locale = useLocale();
  // The blocks are on the landing page. From another page the links go there first.
  const home = getPathname({ href: '/', locale });
  const block = (anchor: string): string => `${home}#${anchor}`;

  return (
    <footer className="bg-berry-950 text-white">
      <div className={`pt-12 pb-8 lg:pt-16 lg:pb-9 ${container}`}>
        <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-10 md:grid-cols-[1.9fr_1fr_1.3fr] lg:gap-x-10 xl:grid-cols-[20.5rem_auto_auto_minmax(0,1fr)] xl:gap-x-16">
          <div className="col-span-2 md:col-span-1">
            <Logo tone="white" className="text-[32px]" />
            <p className="mt-3.5 text-[15px] leading-[1.55] font-medium text-white/65">
              {t('footer.about')}
            </p>
            <StoreButtons tone="onDark" className="mt-6 sm:max-w-82" />
          </div>
          <div>
            <h3 className={columnTitle}>{t('footer.shopping.title')}</h3>
            <ul className={columnLinks}>
              {shoppingBlocks.map((key) => (
                <li key={key}>
                  <a href={block(anchors[key])} className={columnLink}>
                    {t(`site.nav.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className={columnTitle}>{t('footer.company.title')}</h3>
            <ul className={columnLinks}>
              <li>
                <SellerRegistrationLink className={columnLink}>
                  {t('site.actions.sell')}
                </SellerRegistrationLink>
              </li>
              <li>
                <a href={`mailto:${operator.privacyEmail}`} className={columnLink}>
                  {operator.privacyEmail}
                </a>
              </li>
              <li>
                <Link href={privacyPolicyPath} className={columnLink}>
                  {t('footer.company.privacy')}
                </Link>
              </li>
              <li>
                <Link href={unsubscribePath} className={columnLink}>
                  {t('footer.company.unsubscribe')}
                </Link>
              </li>
              {/* Only where there is a choice to change: a store that measures nothing asks nothing. */}
              {analyticsId() ? (
                <li>
                  <CookieSettingsButton className={columnLink}>
                    {t('cookies.settings')}
                  </CookieSettingsButton>
                </li>
              ) : null}
            </ul>
          </div>
          {/* On a tablet the form stands next to its title, on a phone and a computer under it. */}
          <div className="col-span-2 md:col-span-3 md:max-xl:grid md:max-xl:grid-cols-[1fr_1.25fr] md:max-xl:items-center md:max-xl:gap-x-10 xl:col-span-1">
            <div>
              <h3 className="text-[17px] font-bold tracking-[-0.01em]">
                {t('footer.newsletter.title')}
              </h3>
              <p className="mt-1.5 text-[15px] leading-[1.55] font-medium text-white/65">
                {t('footer.newsletter.text')}
              </p>
            </div>
            <NewsletterForm
              className="mt-4 md:max-xl:mt-0"
              labels={{
                email: t('footer.newsletter.email'),
                submit: t('footer.newsletter.submit'),
                consent: t.rich('footer.newsletter.consent', {
                  policy: (chunks) => (
                    <Link
                      href={privacyPolicyPath}
                      className={`font-bold whitespace-nowrap text-white underline decoration-white/40 underline-offset-2 transition-colors hover:decoration-white ${focusRing}`}
                    >
                      {chunks}
                    </Link>
                  ),
                }),
                errors: {
                  VALIDATION_FAILED: t('footer.newsletter.errors.VALIDATION_FAILED'),
                  UNKNOWN: t('footer.newsletter.errors.UNKNOWN'),
                },
                joined: {
                  title: t('footer.newsletter.joined.title'),
                  text: t('footer.newsletter.joined.text'),
                },
              }}
              join={subscribe.bind(null, locale)}
            />
          </div>
        </div>
        <div className="mt-10 h-px bg-white/12 lg:mt-12" />
        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="flex flex-col gap-1 text-[13px] leading-[1.5] font-medium text-white/50 xl:flex-row xl:gap-0">
            <span>{t('footer.copyright')}</span>
            <span aria-hidden className="mx-2.5 text-white/25 max-xl:hidden">
              |
            </span>
            <span className="text-balance">
              {t('footer.legal', {
                name: operator.name,
                registrationNumber: operator.registrationNumber,
                address: operator.address,
              })}
            </span>
          </p>
          <ul className="flex flex-none flex-wrap gap-1.5 sm:gap-2">
            {payments.map((payment) => (
              <li
                key={payment}
                className="inline-flex h-8 items-center rounded-xs bg-white/8 px-2.5 text-xs font-semibold text-white/75 sm:px-3 sm:text-[13px]"
              >
                {t(`footer.payments.${payment}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

import { Avatar } from '@bluberi/ui/components/avatar';
import { Badge } from '@bluberi/ui/components/badge';
import { buttonClasses } from '@bluberi/ui/components/button';
import { Logo } from '@bluberi/ui/components/logo';
import { ArrowRightIcon, CheckIcon, TimerIcon } from '@phosphor-icons/react/ssr';
import { useFormatter, useTranslations } from 'next-intl';

import { container, iconTile, lead, sectionTitle } from '../layout';
import { SellerBenefits } from '../seller-benefits';
import { SellerRegistrationLink } from '../seller-registration-link';
import { FloatingCard } from './floating-card';
import { Photo } from './photo';
import { crowns, orderNumbers, sellerDashboard } from './sample';

/** How much each day of the drawn week sold. The best day is in the deep gradient, the last one in pink. */
const weekBars = [
  'h-[40%] bg-berry-200',
  'h-[55%] bg-berry-200',
  'h-[48%] bg-berry-200',
  'h-[70%] bg-berry-200',
  'h-[62%] bg-berry-200',
  'h-[92%] bg-berry',
  'h-[76%] bg-pink-300',
] as const;

const orderRow = 'flex items-center gap-3 py-2.5';
const orderPhoto = 'relative size-11 flex-none overflow-hidden rounded-xs bg-gray-100';

/** The picture of the seller portal: the numbers of the day, the week and two orders. */
function SellerDashboard() {
  const t = useTranslations('landing.preview.seller');
  const format = useFormatter();
  const figures = [
    {
      key: 'sales',
      value: format.number(sellerDashboard.salesToday / 100, crowns),
      change: format.number(sellerDashboard.salesGrowth, {
        style: 'percent',
        signDisplay: 'always',
      }),
      changeLook: 'text-green-500',
    },
    {
      key: 'orders',
      value: format.number(sellerDashboard.orders),
      change: format.number(sellerDashboard.newOrders, { signDisplay: 'always' }),
      changeLook: 'text-green-500',
    },
    {
      key: 'payout',
      value: format.number(sellerDashboard.payout / 100, crowns),
      change: t('payoutDay'),
      changeLook: 'text-gray-600',
    },
  ] as const;

  return (
    <div
      aria-hidden
      className="pointer-events-none relative select-none max-md:hidden lg:[zoom:0.8] xl:[zoom:1]"
    >
      {/* The plate cuts the shadow of the card off at its own edge. */}
      <div className="overflow-hidden rounded-2xl bg-soft p-11">
        <div className="rounded-lg border border-gray-200 bg-white p-5.5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5">
              <Logo className="text-2xl" />
              <Badge tone="violet">{t('badge')}</Badge>
            </span>
            <Avatar name={sellerDashboard.seller} />
          </div>
          <div className="mt-4.5 grid grid-cols-3 gap-3">
            {figures.map(({ key, value, change, changeLook }) => (
              <p
                key={key}
                className="flex flex-col gap-1.5 rounded-lg border border-gray-200 px-4 py-3.5"
              >
                <span className="text-[13px] font-bold text-gray-600">{t(key)}</span>
                <span className="text-[22px] font-extrabold tracking-[-0.02em] whitespace-nowrap">
                  {value}
                </span>
                <span className={`text-[12.5px] font-extrabold ${changeLook}`}>{change}</span>
              </p>
            ))}
          </div>
          <div className="mt-4 flex h-30 items-end gap-2.5">
            {weekBars.map((bar) => (
              <span key={bar} className={`flex-1 rounded-t-xs ${bar}`} />
            ))}
          </div>
          <div className="mt-4 mb-1 h-px bg-gray-200" />
          <div className={orderRow}>
            <span className={orderPhoto}>
              <Photo name="product-hoodie" sizes="44px" />
            </span>
            <p className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-extrabold">
                {t('hoodieOrder', { number: orderNumbers.hoodie })}
              </span>
              <span className="text-xs font-semibold text-gray-600">{t('hoodieDelivery')}</span>
            </p>
            <span className="inline-flex h-7 flex-none items-center gap-1.5 rounded-xs bg-berry-950 px-2.5 text-[13px] font-extrabold text-white tabular-nums">
              <TimerIcon weight="bold" className="size-3.5 text-pink-300" />
              {sellerDashboard.timeToConfirm}
            </span>
            <span className={buttonClasses({ size: 'sm' })}>{t('confirm')}</span>
          </div>
          <div className={orderRow}>
            <span className={orderPhoto}>
              <Photo name="product-tee" sizes="44px" />
            </span>
            <p className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-extrabold">
                {t('teeOrder', { number: orderNumbers.tee })}
              </span>
              <span className="text-xs font-semibold text-gray-600">{t('teeDelivery')}</span>
            </p>
            <Badge tone="amber">{t('waiting')}</Badge>
            <span className={buttonClasses({ size: 'sm', variant: 'outline' })}>{t('label')}</span>
          </div>
        </div>
      </div>
      <FloatingCard className="-top-6 right-6 flex items-center gap-3 lg:-right-5">
        <span className={`size-10.5 ${iconTile.light}`}>
          <CheckIcon weight="bold" className="size-5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-gray-600">{t('payoutSent')}</span>
          <span className="text-base font-extrabold">
            {format.number(sellerDashboard.payout / 100, crowns)}
          </span>
        </span>
      </FloatingCard>
    </div>
  );
}

/**
 * "Prodávejte na Bluberi": what Bluberi gives a seller. The button leads to the page for sellers,
 * where a new seller leaves their contacts and a seller who has an account signs in.
 */
export function Sellers() {
  const t = useTranslations();

  return (
    <section className={`pb-14 lg:pt-2 lg:pb-24 ${container}`}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.12fr] lg:items-center lg:gap-12 xl:gap-18">
        <div>
          <h2 className={sectionTitle}>{t('landing.sellers.title')}</h2>
          <p className={`mt-2 lg:mt-3 ${lead}`}>{t('landing.sellers.lead')}</p>
          <SellerBenefits className="mt-6 md:grid-cols-2 lg:mt-8 lg:grid-cols-1" />
          <SellerRegistrationLink
            className={`mt-6 max-sm:w-full lg:mt-8 ${buttonClasses({ size: 'lg', pill: true })}`}
          >
            {t('site.actions.startSelling')}
            <ArrowRightIcon weight="bold" />
          </SellerRegistrationLink>
        </div>
        <SellerDashboard />
      </div>
    </section>
  );
}

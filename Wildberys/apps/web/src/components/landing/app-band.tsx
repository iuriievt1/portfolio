import { Avatar } from '@bluberi/ui/components/avatar';
import { buttonClasses } from '@bluberi/ui/components/button';
import { Logo } from '@bluberi/ui/components/logo';
import {
  CaretLeftIcon,
  CheckIcon,
  ClockIcon,
  LightningIcon,
  PhoneIcon,
} from '@phosphor-icons/react/ssr';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';

import { AppleLogo } from '../apple-logo';
import { belowHeader, container } from '../layout';
import { StoreButtons } from '../store-buttons';
import { anchors } from './anchors';
import { DeliveryProgress } from './delivery-progress';
import { MapMark, onMap } from './map-mark';
import { Phone, StatusBar } from './phone';
import { checkout, crowns, orderNumbers } from './sample';

/** The steps of the drawn delivery that are done, with the time of each. */
const stepsDone = [
  { key: 'accepted', time: '14:02' },
  { key: 'handedOver', time: '14:21' },
] as const;

/** The screen that follows a courier: the map, the time left and the steps of the delivery. */
function TrackingScreen() {
  const t = useTranslations('landing.preview');
  const courier = t('tracking.courierName');

  return (
    <>
      <div className="absolute inset-x-0 top-0 h-100">
        <Image src="/landing/map-route.svg" alt="" fill />
        <MapMark kind="store" className={`top-[32.5%] left-[20.5%] size-12 ${onMap}`} />
        <MapMark kind="courier" className={`top-[62.5%] left-[60.3%] size-12 ${onMap}`} />
        <MapMark kind="home" className={`top-[80%] left-[76.9%] size-12 ${onMap}`} />
      </div>
      <StatusBar />
      <div className="absolute inset-x-3 top-89 z-5 flex flex-col gap-3.5 rounded-xl bg-white px-4.5 pt-4.5 pb-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-bold text-gray-600">
              {t('tracking.order', { number: orderNumbers.hoodie })}
            </span>
            <span className="text-[22px] font-extrabold tracking-[-0.025em]">
              {t('courier.title')}
            </span>
          </p>
          <span className="inline-flex h-8.5 flex-none items-center gap-1.5 rounded-xs bg-berry-950 px-2.5 text-[15px] font-extrabold whitespace-nowrap text-white tabular-nums">
            <ClockIcon weight="bold" className="size-3.75 text-pink-300" />
            {t('courier.eta')}
          </span>
        </div>
        <DeliveryProgress />
        <div className="flex items-center gap-3 rounded-md bg-gray-50 p-3">
          <Avatar name={courier} size="md" />
          <p className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-extrabold">{courier}</span>
            <span className="text-xs font-semibold text-gray-600">{t('tracking.courierInfo')}</span>
          </p>
          <span className="flex size-11 flex-none items-center justify-center rounded-full bg-berry-100 text-berry-600">
            <PhoneIcon weight="fill" className="size-5" />
          </span>
        </div>
        <div className="flex flex-col gap-2.5 text-sm font-bold">
          {stepsDone.map(({ key, time }) => (
            <p key={key} className="flex items-center gap-2.5">
              <span className="flex size-5 flex-none items-center justify-center rounded-full bg-berry-500 text-white">
                <CheckIcon weight="bold" className="size-3" />
              </span>
              {t(`tracking.${key}`)}
              <span className="ml-auto font-semibold text-gray-600">{time}</span>
            </p>
          ))}
          <p className="flex items-center gap-2.5 font-extrabold text-berry-500">
            <span className="size-5 flex-none rounded-full border-6 border-berry-500 bg-white" />
            {t('tracking.onTheWay')}
            <span className="ml-auto font-semibold">14:33</span>
          </p>
        </div>
      </div>
    </>
  );
}

const deliveries = ['express', 'evening', 'pickup'] as const;

/** The checkout of the app: the ways of delivery with their prices, the total and Apple Pay. */
function CheckoutScreen() {
  const t = useTranslations('landing.preview.checkout');
  const format = useFormatter();

  return (
    <>
      <StatusBar />
      <div className="flex h-12 flex-none items-center justify-between px-4 pt-1.5 pb-2.5">
        <span className="flex w-18 items-center gap-0.5 text-[17px] font-semibold text-berry-500">
          <CaretLeftIcon weight="bold" className="size-5 flex-none" />
          {t('back')}
        </span>
        <span className="text-[17px] font-extrabold">{t('title')}</span>
        <span className="w-18" />
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-1.5">
        <p className="text-[13px] font-extrabold tracking-[0.08em] text-gray-600 uppercase">
          {t('delivery')}
        </p>
        {deliveries.map((delivery) => {
          const chosen = delivery === 'express';

          return (
            <div
              key={delivery}
              className={`flex items-center gap-3 rounded-lg bg-white p-3.5 ${
                chosen ? 'border-2 border-berry-500' : 'border border-gray-200'
              }`}
            >
              <span
                className={`size-5 flex-none rounded-full bg-white ${
                  chosen ? 'border-6 border-berry-500' : 'border-[1.8px] border-gray-300'
                }`}
              />
              <p className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                  {chosen ? (
                    <LightningIcon weight="fill" className="size-4 text-berry-500" />
                  ) : null}
                  {t(`${delivery}.title`)}
                </span>
                <span className="text-xs font-semibold text-gray-600">{t(`${delivery}.text`)}</span>
              </p>
              <b className="text-[15px]">{format.number(checkout[delivery] / 100, crowns)}</b>
            </div>
          );
        })}
        <p className="mt-2 flex items-center justify-between">
          <span className="text-[15px] font-bold text-gray-600">{t('total')}</span>
          <b className="text-2xl font-extrabold tracking-[-0.025em]">
            {format.number(checkout.total / 100, crowns)}
          </b>
        </p>
        <span className={`mt-1 ${buttonClasses({ size: 'lg', variant: 'dark' })}`}>
          <AppleLogo />
          {t('pay')}
        </span>
      </div>
    </>
  );
}

/** "Celý obchod v telefonu": the band about the app, with the buttons of the two stores. */
export function AppBand() {
  const t = useTranslations('landing.app');

  return (
    <section id={anchors.app} className={`py-12 lg:py-20 ${belowHeader} ${container}`}>
      <div className="relative overflow-hidden rounded-xl bg-app-band px-4 py-8 text-white sm:px-6 sm:py-9 md:flex md:h-80 md:flex-col md:justify-center md:px-9 md:py-0 lg:h-110 lg:rounded-3xl lg:px-12 xl:h-128 xl:px-18 2xl:h-140">
        {/* The title is as large as one line of this column allows. */}
        <div className="@container md:max-w-[49%] lg:max-w-[46%]">
          <Logo tone="white" mark="white" className="text-[32px] lg:text-[42px] xl:text-[50px]" />
          <h2 className="mt-5 text-[clamp(1.375rem,8.8cqw,1.625rem)] leading-[1.15] font-bold tracking-[-0.025em] sm:text-[clamp(1.375rem,8.8cqw,2.75rem)] lg:mt-7">
            {t('title')}
          </h2>
          <p className="mt-2.5 text-[clamp(0.875rem,5.2cqw,1rem)] leading-[1.6] font-medium text-balance text-white/80 lg:mt-3 lg:text-[17px]">
            {t('lead')}
          </p>
          <StoreButtons className="mt-6 sm:max-w-82 lg:mt-8" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-140 w-155 select-none max-md:hidden md:[zoom:0.5] lg:[zoom:0.76] xl:[zoom:0.9] 2xl:[zoom:1]"
        >
          <div className="absolute top-16 left-4 z-2">
            <Phone className="[zoom:0.72]">
              <TrackingScreen />
            </Phone>
          </div>
          <div className="absolute top-25 left-84 z-3 rotate-5">
            <Phone className="[zoom:0.72]">
              <CheckoutScreen />
            </Phone>
          </div>
        </div>
      </div>
    </section>
  );
}

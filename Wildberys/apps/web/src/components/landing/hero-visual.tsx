import { Badge } from '@bluberi/ui/components/badge';
import { buttonClasses } from '@bluberi/ui/components/button';
import { Logo } from '@bluberi/ui/components/logo';
import {
  BellIcon,
  CarIcon,
  CaretLeftIcon,
  ExportIcon,
  HeartIcon,
  HouseIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  ShoppingBagIcon,
  SquaresFourIcon,
  StarIcon,
  UserIcon,
} from '@phosphor-icons/react/ssr';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DeliveryProgress } from './delivery-progress';
import { iconTile } from '../layout';
import { FloatingCard } from './floating-card';
import { Phone, StatusBar } from './phone';
import { Photo, type PhotoName } from './photo';
import { ProductCard } from './product-card';
import { crowns, dress, hoodie, hoodieReviews, tee } from './sample';

const roundButton = 'flex size-10 items-center justify-center rounded-full bg-white [&_svg]:size-5';

/** The small pictures on the main photo of a product. The first one is the photo that is shown. */
const thumbnails: readonly PhotoName[] = ['product-hoodie', 'product-tee', 'product-dress'];

const thumbnail = 'h-16.5 w-13 overflow-hidden rounded-sm';
const thumbnailOutline = 'ring-1 ring-berry-800/10';

const sizes = [
  { label: 'XS', state: 'free' },
  { label: 'S', state: 'chosen' },
  { label: 'M', state: 'free' },
  { label: 'L', state: 'free' },
  { label: 'XL', state: 'soldOut' },
] as const;

const sizeStates = {
  free: 'border-[1.5px] border-gray-300 bg-white',
  chosen: 'border-2 border-berry-500 bg-berry-50 text-berry-600',
  soldOut: 'border-[1.5px] border-gray-100 bg-gray-100 text-gray-400 line-through',
} as const;

/** The product page of the app: the photo with its thumbnails, the price, the sizes, the delivery promise. */
function ProductScreen() {
  const t = useTranslations('landing');
  const format = useFormatter();

  return (
    <>
      <div className="relative h-117.5 flex-none bg-gray-100">
        <Photo name="product-hoodie" sizes="270px" eager />
        <span className="absolute bottom-4.5 left-4 z-5 flex gap-2">
          {thumbnails.map((photo, index) => (
            <span
              key={photo}
              className={`relative border-3 border-white bg-white ${thumbnail} ${
                index === 0 ? 'ring-[2.5px] ring-berry-500' : thumbnailOutline
              }`}
            >
              <Photo name={photo} sizes="52px" eager />
            </span>
          ))}
          <span
            className={`flex items-center justify-center bg-white/94 text-[13px] font-extrabold text-berry-600 ${thumbnail} ${thumbnailOutline}`}
          >
            +3
          </span>
        </span>
      </div>
      {/* The top line and the buttons lie over the photo. */}
      <div className="absolute inset-x-0 top-0">
        <StatusBar />
        <div className="relative z-5 flex items-center justify-between px-4 py-1">
          <span className={roundButton}>
            <CaretLeftIcon weight="bold" />
          </span>
          <span className="flex gap-2">
            <span className={roundButton}>
              <ExportIcon weight="bold" />
            </span>
            <span className={`text-pink-500 ${roundButton}`}>
              <HeartIcon weight="fill" />
            </span>
          </span>
        </div>
      </div>
      <div className="absolute inset-x-0 top-112 bottom-0 flex flex-col gap-2.5 rounded-t-xl bg-white px-4.5 py-5">
        <p className="flex items-center gap-2">
          <b className="text-[28px] font-extrabold tracking-[-0.025em] text-pink-600">
            {format.number(hoodie.price / 100, crowns)}
          </b>
          <s className="text-[15px] font-semibold text-gray-400">
            {format.number(hoodie.oldPrice / 100, crowns)}
          </s>
          <span className="ml-auto flex">
            <Badge tone="sale">
              {format.number((hoodie.price - hoodie.oldPrice) / hoodie.oldPrice, {
                style: 'percent',
              })}
            </Badge>
          </span>
        </p>
        <p className="text-[15px] font-semibold text-gray-700">{t('products.items.hoodie')}</p>
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-gray-600">
          <StarIcon weight="fill" className="size-3.75 text-star" />
          {t('preview.product.reviews', {
            rating: format.number(hoodieReviews.rating, { minimumFractionDigits: 1 }),
            count: format.number(hoodieReviews.count),
          })}
        </p>
        <p className="mt-1 flex gap-2">
          {sizes.map(({ label, state }) => (
            <span
              key={label}
              className={`inline-flex h-11 min-w-13 items-center justify-center rounded-sm px-2.5 text-sm font-bold ${sizeStates[state]}`}
            >
              {label}
            </span>
          ))}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-[13px] font-extrabold text-berry-500">
          <LightningIcon weight="fill" className="size-4" />
          {t('preview.product.delivery')}
        </p>
        <span className={`mt-1.5 ${buttonClasses({ size: 'lg' })}`}>
          {t('preview.product.addToCart')}
        </span>
      </div>
    </>
  );
}

const filters = ['all', 'women', 'men', 'kids', 'shoes'] as const;

/** The home screen of the app: the search, a banner, the first products and the tab bar. */
function HomeScreen() {
  const t = useTranslations('landing.preview.home');
  const tabs: readonly {
    key: 'home' | 'catalog' | 'cart' | 'favorites' | 'profile';
    icon: ReactNode;
  }[] = [
    { key: 'home', icon: <HouseIcon weight="fill" /> },
    { key: 'catalog', icon: <SquaresFourIcon /> },
    { key: 'cart', icon: <ShoppingBagIcon /> },
    { key: 'favorites', icon: <HeartIcon /> },
    { key: 'profile', icon: <UserIcon /> },
  ];

  return (
    <>
      <StatusBar />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-1 pb-3">
          <Logo className="text-[30px]" />
          <span className="flex size-10 items-center justify-center rounded-full bg-gray-100">
            <BellIcon className="size-5" />
          </span>
        </div>
        <p className="mx-4 flex h-11.5 items-center gap-3 rounded-md bg-gray-100 px-4 text-[15px] font-medium text-gray-600">
          <MagnifyingGlassIcon className="size-5" />
          {t('search')}
        </p>
        <p className="flex gap-2 overflow-hidden px-4 py-3">
          {filters.map((filter, index) => (
            <span
              key={filter}
              className={`inline-flex h-8.5 flex-none items-center rounded-full border-[1.5px] px-4 text-sm font-bold whitespace-nowrap ${
                index === 0
                  ? 'border-berry-950 bg-berry-950 text-white'
                  : 'border-gray-300 bg-white'
              }`}
            >
              {t(`filters.${filter}`)}
            </span>
          ))}
        </p>
        <div className="relative mx-4 mt-0.5 h-39 overflow-hidden rounded-lg bg-brand p-4.5 text-white">
          <p className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
            {t('banner.label')}
          </p>
          <p className="mt-1.5 text-2xl leading-[1.2] font-extrabold tracking-[-0.025em]">
            {t('banner.first')}
            <br />
            {t('banner.second')}
          </p>
          <span className={`mt-3 ${buttonClasses({ size: 'sm', variant: 'white' })}`}>
            {t('banner.action')}
          </span>
          <span className="absolute inset-y-3 right-3 w-30.5 overflow-hidden rounded-md">
            <Photo name="product-hoodie" sizes="122px" eager />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 py-3.5">
          <ProductCard product={tee} sizes="171px" favorite="off" eager />
          <ProductCard product={dress} sizes="171px" favorite="on" eager />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-30 flex h-21.5 justify-around border-t border-gray-200 bg-white/96 pt-2">
        {tabs.map(({ key, icon }, index) => (
          <span
            key={key}
            className={`relative flex w-17.5 flex-col items-center gap-1 text-[10.5px] font-bold [&_svg]:size-6.25 ${
              index === 0 ? 'text-berry-500' : 'text-gray-400'
            }`}
          >
            {icon}
            {t(`tabs.${key}`)}
            {key === 'cart' ? (
              <span className="absolute -top-1 right-4 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-pink-500 px-1.25 text-white">
                2
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </>
  );
}

interface ExpressCardProps {
  readonly size?: 'sm' | 'md';
  readonly className: string;
}

/** The card that promises the express delivery. */
function ExpressCard({ size = 'md', className }: ExpressCardProps) {
  const t = useTranslations('landing.preview.express');

  return (
    <FloatingCard size={size} className={`flex items-center gap-3 ${className}`}>
      <span
        className={`${iconTile.light} ${
          size === 'sm' ? 'size-9 [&_svg]:size-4.5' : 'size-10.5 [&_svg]:size-5.5'
        }`}
      >
        <LightningIcon weight="duotone" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span
          className={`font-semibold text-gray-600 ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}
        >
          {t('label')}
        </span>
        <span className={`font-bold ${size === 'sm' ? 'text-sm' : 'text-base'}`}>{t('title')}</span>
      </span>
    </FloatingCard>
  );
}

/** The phones stand turned a little to the left, like on a product photo. */
const turnedInSpace = '[transform:perspective(1800px)_rotateY(-17deg)_rotateX(5deg)_rotateZ(2deg)]';

interface HeroVisualProps {
  /** Where the picture stands and how large it is drawn: a "zoom" of its full size. */
  readonly className: string;
}

/**
 * The picture of the first screen on a computer: two phones with the app, the product page
 * behind the home screen, and two cards about the delivery. It is 720 by 720.
 */
export function HeroVisual({ className }: HeroVisualProps) {
  const t = useTranslations('landing.preview.courier');

  return (
    <div aria-hidden className={`pointer-events-none size-180 flex-none select-none ${className}`}>
      <div className={`absolute top-7 left-90 z-2 ${turnedInSpace}`}>
        <Phone turned className="[zoom:0.66]">
          <ProductScreen />
        </Phone>
      </div>
      <div className={`absolute top-23 left-17 z-4 ${turnedInSpace}`}>
        <Phone turned className="[zoom:0.7]">
          <HomeScreen />
        </Phone>
      </div>
      <ExpressCard className="top-45 left-0" />
      <FloatingCard className="top-130 left-103 flex w-70 flex-col gap-2.5">
        <span className="flex items-center justify-between">
          <span className="text-sm font-extrabold">{t('title')}</span>
          <Badge tone="violet">{t('eta')}</Badge>
        </span>
        <DeliveryProgress />
        <span className="flex items-center justify-between text-xs font-bold text-gray-600 [&_svg]:size-3.75">
          <span className="flex items-center gap-1">
            <PackageIcon weight="fill" className="text-green-500" />
            {t('handedOver')}
          </span>
          <span className="flex items-center gap-1">
            <CarIcon weight="fill" className="text-berry-500" />
            {t('onTheWay')}
          </span>
          <span className="flex items-center gap-1">
            <HouseIcon weight="fill" className="text-gray-400" />
            {t('home')}
          </span>
        </span>
      </FloatingCard>
    </div>
  );
}

/**
 * The picture of the first screen on a phone: one phone with the home screen of the app.
 * Its lower part fades out, so the page goes on under it.
 */
export function HeroPhone({ className }: HeroVisualProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none relative -mx-5 h-96 select-none [mask-image:linear-gradient(to_bottom,black_72%,transparent)] sm:-mx-8 ${className}`}
    >
      <div className={`absolute top-3 left-1/2 -ml-34 ${turnedInSpace}`}>
        <Phone turned className="[zoom:0.64]">
          <HomeScreen />
        </Phone>
      </div>
      <ExpressCard size="sm" className="top-24 left-[max(1.25rem,calc(50%-11rem))]" />
    </div>
  );
}

import { Badge } from '@bluberi/ui/components/badge';
import { LightningIcon, MoonStarsIcon, PackageIcon } from '@phosphor-icons/react/ssr';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { belowHeader, container, iconTile, lead, sectionTitle } from '../layout';
import { anchors } from './anchors';
import { MapMark, onMap } from './map-mark';

/** The three cards of the block: dark, in the brand gradient and white. */
const tones = {
  dark: { card: 'bg-berry-950 text-white', icon: iconTile.dark },
  brand: { card: 'bg-brand text-white', icon: iconTile.dark },
  white: { card: 'bg-white shadow-md', icon: iconTile.light },
} as const;

const options: readonly {
  key: 'express' | 'today' | 'tomorrow';
  tone: keyof typeof tones;
  icon: ReactNode;
}[] = [
  { key: 'express', tone: 'dark', icon: <LightningIcon weight="duotone" /> },
  { key: 'today', tone: 'brand', icon: <MoonStarsIcon weight="duotone" /> },
  { key: 'tomorrow', tone: 'white', icon: <PackageIcon weight="duotone" /> },
];

/**
 * The picture of a delivery through Prague: from the store to the door. The courier's car
 * says in a speech bubble how far it is.
 */
function CourierMap() {
  const t = useTranslations('landing.delivery.map');

  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-xl shadow-md max-lg:hidden lg:min-h-75 xl:min-h-85"
    >
      <Image src="/landing/map-city.svg" alt="" fill />
      <span className="absolute top-4.5 left-4.5 inline-flex h-7.5 items-center rounded-full bg-white px-3 text-[13px] font-bold text-gray-700">
        {t('city')}
      </span>
      <MapMark kind="store" className={`top-[26.2%] left-[15.9%] size-12 ${onMap}`} />
      <MapMark kind="home" className={`top-[78.6%] left-[84.5%] size-12 ${onMap}`} />
      {/* The car and its bubble stand at one point of the map, so they stay together at any width. */}
      <div className={`top-[59.5%] left-[51.1%] ${onMap}`}>
        <MapMark kind="courier" className="size-13" />
        <p className="absolute bottom-full left-1/2 mb-3.5 flex -translate-x-1/2 items-center gap-2 rounded-md bg-white py-2 pr-2 pl-3.5 text-[13px] font-bold whitespace-nowrap text-berry-950 shadow-lg after:absolute after:top-full after:left-1/2 after:size-3.5 after:-translate-1/2 after:rotate-45 after:bg-white">
          {t('courier')}
          <Badge tone="violet">{t('eta')}</Badge>
        </p>
      </div>
    </div>
  );
}

/**
 * "Tak rychle, jak chcete": the three speeds of delivery. On a phone they are rows whose texts
 * start at the same place, on a tablet three cards, on a computer the cards stand next to a map.
 */
export function Delivery() {
  const t = useTranslations('landing.delivery');

  return (
    <section id={anchors.delivery} className={`bg-soft ${belowHeader}`}>
      <div className={`py-12 lg:py-20 ${container}`}>
        <h2 className={sectionTitle}>{t('title')}</h2>
        <p className={`mt-2 lg:mt-3 ${lead}`}>{t('lead')}</p>
        <div className="mt-6 grid grid-cols-[auto_1fr] gap-y-2.5 md:grid-cols-3 md:gap-4 lg:mt-9 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-5">
          {options.map(({ key, tone, icon }) => (
            <div
              key={key}
              className={`col-span-2 grid grid-cols-subgrid items-center gap-x-4 rounded-lg px-5 py-4.5 md:col-span-1 md:flex md:min-h-62 md:flex-col md:items-stretch md:p-6 lg:min-h-75 lg:rounded-xl xl:min-h-82 xl:p-7 ${tones[tone].card}`}
            >
              <span className={`size-12 max-md:hidden [&_svg]:size-6 ${tones[tone].icon}`}>
                {icon}
              </span>
              {/* English words are longer than Czech ones, so they are set smaller to fit the card. */}
              <p className="text-[30px] leading-none font-bold tracking-[-0.035em] md:mt-auto md:text-[40px] xl:text-[52px] [&:lang(en)]:text-[25px] md:[&:lang(en)]:text-[30px] xl:[&:lang(en)]:text-[38px]">
                {t(`options.${key}.value`)}
              </p>
              <p className="text-[15px] font-bold md:mt-3 md:text-[17px] xl:text-lg">
                {t(`options.${key}.title`)}
              </p>
            </div>
          ))}
          <CourierMap />
        </div>
      </div>
    </section>
  );
}

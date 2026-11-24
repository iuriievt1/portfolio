import { Badge } from '@bluberi/ui/components/badge';
import { HeartIcon, LightningIcon } from '@phosphor-icons/react/ssr';
import { useFormatter, useTranslations } from 'next-intl';

import { Photo } from './photo';
import { crowns, type SampleProduct } from './sample';

interface ProductCardProps {
  readonly product: SampleProduct;
  /** How wide the card is drawn, for the browser to pick a photo of the right size. */
  readonly sizes: string;
  /** The heart of the drawn app. The page itself has no favorites yet, so its cards leave it out. */
  readonly favorite?: 'on' | 'off';
  /** Loads the photo together with the page, for a card on the first screen. */
  readonly eager?: boolean;
}

/** A product: its photo with the badges, the name and the price. */
export function ProductCard({ product, sizes, favorite, eager = false }: ProductCardProps) {
  const t = useTranslations('landing.products');
  const format = useFormatter();
  const { price, oldPrice, delivery } = product;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
        <Photo name={product.photo} sizes={sizes} eager={eager} />
        <span className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.25">
          {delivery ? (
            <Badge tone="express">
              <LightningIcon weight="fill" />
              {t(`badges.${delivery}`)}
            </Badge>
          ) : null}
          {oldPrice ? (
            <Badge tone="sale">
              {format.number((price - oldPrice) / oldPrice, { style: 'percent' })}
            </Badge>
          ) : null}
        </span>
        {favorite ? (
          <span
            className={`absolute top-2.5 right-2.5 flex size-8.5 items-center justify-center rounded-full bg-white/90 ${
              favorite === 'on' ? 'text-pink-500' : 'text-berry-950'
            }`}
          >
            <HeartIcon weight={favorite === 'on' ? 'fill' : 'regular'} className="size-4.5" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="truncate text-sm font-semibold text-gray-700">{t(`items.${product.name}`)}</p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <b
            className={`text-[17px] font-bold tracking-[-0.01em] ${oldPrice ? 'text-pink-600' : ''}`}
          >
            {format.number(price / 100, crowns)}
          </b>
          {oldPrice ? (
            <s className="text-[13px] font-semibold text-gray-400">
              {format.number(oldPrice / 100, crowns)}
            </s>
          ) : null}
        </p>
      </div>
    </div>
  );
}

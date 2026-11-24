import { useTranslations } from 'next-intl';

import { Carousel } from '../carousel';
import { belowHeader, container, sectionTitle } from '../layout';
import { anchors } from './anchors';
import { Photo } from './photo';

const categories = [
  'women',
  'men',
  'kids',
  'shoes',
  'cosmetics',
  'accessories',
  'sport',
  'home',
  'electronics',
] as const;

/**
 * What the store sells, as a row that goes round by itself. The cards become links
 * when the catalog opens.
 */
export function Categories() {
  const t = useTranslations('landing.categories');

  return (
    <section id={anchors.categories} className={`pt-12 lg:pt-20 ${belowHeader} ${container}`}>
      <h2 className={`mb-5 lg:mb-8 ${sectionTitle}`}>{t('title')}</h2>
      <Carousel
        everyMs={4000}
        cardClassName="w-[42%] sm:w-[29%] md:w-[22.5%] lg:w-[calc((100%-5rem)/5)]"
      >
        {categories.map((category) => (
          <div key={category}>
            <div className="relative aspect-4/5 overflow-hidden rounded-lg bg-gray-100 lg:rounded-xl">
              <Photo
                name={`category-${category}`}
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 23vw, (min-width: 640px) 29vw, 42vw"
              />
            </div>
            <p className="mt-2.5 text-[15px] font-bold tracking-[-0.01em] lg:mt-3.5 lg:text-lg">
              {t(`items.${category}`)}
            </p>
          </div>
        ))}
      </Carousel>
    </section>
  );
}

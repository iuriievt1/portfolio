import { useTranslations } from 'next-intl';

import { Carousel } from '../carousel';
import { belowHeader, container, sectionTitle } from '../layout';
import { anchors } from './anchors';
import { ProductCard } from './product-card';
import { newProducts } from './sample';

/**
 * "Novinky": what is on the shelves, as a row that goes round by itself. The buyer's button
 * of the page leads here until the catalog opens.
 */
export function Products() {
  const t = useTranslations('landing.products');

  return (
    <section
      id={anchors.products}
      className={`pt-12 pb-14 lg:pt-18 lg:pb-24 ${belowHeader} ${container}`}
    >
      <h2 className={`mb-5 lg:mb-8 ${sectionTitle}`}>{t('title')}</h2>
      <Carousel
        everyMs={5000}
        cardClassName="w-[42%] sm:w-[29%] md:w-[22.5%] lg:w-[calc((100%-5rem)/5)] xl:w-[calc((100%-6.25rem)/6)]"
      >
        {newProducts.map((product) => (
          <ProductCard
            key={product.name}
            product={product}
            sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 23vw, (min-width: 640px) 29vw, 42vw"
          />
        ))}
      </Carousel>
    </section>
  );
}

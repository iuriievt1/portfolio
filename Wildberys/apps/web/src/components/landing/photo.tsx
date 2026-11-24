import Image from 'next/image';

/** The sample photos in public/photos. Real products replace them when the catalog opens. */
export type PhotoName =
  | 'category-women'
  | 'category-men'
  | 'category-kids'
  | 'category-shoes'
  | 'category-cosmetics'
  | 'category-accessories'
  | 'category-sport'
  | 'category-home'
  | 'category-electronics'
  | 'product-hoodie'
  | 'product-shoes'
  | 'product-dress'
  | 'product-bag'
  | 'product-cream'
  | 'product-watch'
  | 'product-tee'
  | 'product-watch-black'
  | 'product-glasses'
  | 'product-teddy'
  | 'product-headphones'
  | 'product-perfume'
  | 'product-candle'
  | 'product-vase'
  | 'product-bag-pink'
  | 'product-sunglasses'
  | 'product-kettlebell'
  | 'product-bowls'
  | 'product-plant'
  | 'product-spray';

interface PhotoProps {
  readonly name: PhotoName;
  /** How wide the photo is drawn, for the browser to pick a file of the right size. */
  readonly sizes: string;
  readonly className?: string;
  /** Loads the photo together with the page, for a photo on the first screen. */
  readonly eager?: boolean;
}

/** A photo that fills its box. The box sets the size and the corners and hides what does not fit. */
export function Photo({ name, sizes, className = '', eager = false }: PhotoProps) {
  return (
    <Image
      src={`/photos/${name}.jpg`}
      alt=""
      fill
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      className={`object-cover ${className}`}
    />
  );
}

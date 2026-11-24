import type { PhotoName } from './photo';

/**
 * What the pictures of the landing page show before the store has real products:
 * sample products, orders and numbers.
 */

/** How the language of the page writes an amount of money in crowns. */
export const crowns = { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 } as const;

export interface SampleProduct {
  /** The key of the name in the messages. */
  readonly name:
    | 'hoodie'
    | 'shoes'
    | 'dress'
    | 'bag'
    | 'cream'
    | 'watch'
    | 'tee'
    | 'watchBlack'
    | 'glasses'
    | 'teddy'
    | 'headphones'
    | 'perfume'
    | 'candle'
    | 'vase'
    | 'bagPink'
    | 'sunglasses'
    | 'kettlebell'
    | 'bowls'
    | 'plant'
    | 'spray';
  readonly photo: PhotoName;
  /** In haléře, like every amount of money. */
  readonly price: number;
  /** The price before the discount, when there is one. */
  readonly oldPrice?: number;
  /** Set when the product can be delivered today. */
  readonly delivery?: 'today' | 'express';
}

export const hoodie = {
  name: 'hoodie',
  photo: 'product-hoodie',
  price: 89_900,
  oldPrice: 129_000,
  delivery: 'today',
} as const satisfies SampleProduct;

export const tee = {
  name: 'tee',
  photo: 'product-tee',
  price: 54_900,
  delivery: 'today',
} as const satisfies SampleProduct;

export const dress = {
  name: 'dress',
  photo: 'product-dress',
  price: 149_000,
  delivery: 'today',
} as const satisfies SampleProduct;

/** The products of the block "Novinky". */
export const newProducts: readonly SampleProduct[] = [
  hoodie,
  { name: 'shoes', photo: 'product-shoes', price: 199_000 },
  dress,
  { name: 'bag', photo: 'product-bag', price: 99_000, oldPrice: 129_000 },
  { name: 'cream', photo: 'product-cream', price: 45_900, delivery: 'express' },
  { name: 'watch', photo: 'product-watch', price: 249_000 },
  { name: 'headphones', photo: 'product-headphones', price: 129_000, oldPrice: 159_000 },
  { name: 'bagPink', photo: 'product-bag-pink', price: 139_000, delivery: 'today' },
  { name: 'candle', photo: 'product-candle', price: 34_900 },
  { name: 'glasses', photo: 'product-glasses', price: 79_000 },
  tee,
  { name: 'perfume', photo: 'product-perfume', price: 119_000, delivery: 'express' },
  { name: 'vase', photo: 'product-vase', price: 69_000 },
  { name: 'teddy', photo: 'product-teddy', price: 39_900, delivery: 'today' },
  { name: 'watchBlack', photo: 'product-watch-black', price: 189_000 },
  { name: 'sunglasses', photo: 'product-sunglasses', price: 59_000, oldPrice: 79_000 },
  { name: 'kettlebell', photo: 'product-kettlebell', price: 64_900 },
  { name: 'bowls', photo: 'product-bowls', price: 44_900 },
  { name: 'plant', photo: 'product-plant', price: 29_900 },
  { name: 'spray', photo: 'product-spray', price: 25_900, delivery: 'express' },
];

/** What the drawn product page says about its product. */
export const hoodieReviews = { rating: 4.8, count: 312 } as const;

/** The sample orders of the drawn tracking screen and seller portal. */
export const orderNumbers = { hoodie: 'BB-240117', tee: 'BB-240118' } as const;

/** The drawn checkout: what each delivery costs and the total, in haléře. */
export const checkout = { express: 9_900, evening: 7_900, pickup: 6_900, total: 298_800 } as const;

/** The drawn seller dashboard. Of the name of the seller only the initials are shown. */
export const sellerDashboard = {
  seller: 'Studio Lila',
  /** In haléře. */
  salesToday: 1_248_000,
  salesGrowth: 0.18,
  orders: 18,
  newOrders: 4,
  /** In haléře. */
  payout: 3_492_000,
  /** The time left to confirm an express order. */
  timeToConfirm: '08:42',
} as const;

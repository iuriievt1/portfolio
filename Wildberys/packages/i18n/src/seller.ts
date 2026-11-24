import type { CustomerLocale } from './locales';
import cs from './messages/seller/cs.json';
import en from './messages/seller/en.json';

export type SellerMessages = typeof cs;

export const sellerMessages: Record<CustomerLocale, SellerMessages> = { cs, en };

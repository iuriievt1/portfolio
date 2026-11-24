import type { CustomerLocale } from './locales';
import cs from './messages/store/cs.json';
import en from './messages/store/en.json';

export type StoreMessages = typeof cs;

export const storeMessages: Record<CustomerLocale, StoreMessages> = { cs, en };

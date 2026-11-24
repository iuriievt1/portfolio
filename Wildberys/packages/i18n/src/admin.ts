import type { AdminLocale } from './locales';
import ru from './messages/admin/ru.json';

export type AdminMessages = typeof ru;

export const adminMessages: Record<AdminLocale, AdminMessages> = { ru };

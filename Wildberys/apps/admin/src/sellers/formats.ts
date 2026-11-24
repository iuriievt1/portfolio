import type { DateTimeFormatOptions } from 'next-intl';
import type { getFormatter } from 'next-intl/server';

type Formatter = Awaited<ReturnType<typeof getFormatter>>;

/** A moment the way the screens of sellers write it: the day and the time to the minute. */
export const dayAndTime = {
  dateStyle: 'medium',
  timeStyle: 'short',
} as const satisfies DateTimeFormatOptions;

/** A day without the time. */
export const dayOnly = { dateStyle: 'medium' } as const satisfies DateTimeFormatOptions;

const hour = 60 * 60 * 1000;

/** The team checks a seller within a day or two, so the first three days are counted in hours. */
const countedInHours = 72 * hour;

/** How long ago a moment was, in short words: "26 ч назад". */
export function timeAgo(format: Formatter, moment: Date, now: Date): string {
  const age = now.getTime() - moment.getTime();

  return format.relativeTime(moment, {
    now,
    style: 'short',
    unit: age >= hour && age < countedInHours ? 'hour' : undefined,
  });
}

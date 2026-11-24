import type { ReactNode } from 'react';

const tones = {
  /** Nothing to say yet: not started, not checked. */
  gray: 'h-6 bg-gray-100 text-xs text-gray-700',
  violet: 'h-6 bg-berry-100 text-xs text-berry-600',
  amber: 'h-6 bg-amber-100 text-xs text-amber-700',
  green: 'h-6 bg-green-100 text-xs text-green-700',
  red: 'h-6 bg-red-100 text-xs text-red-700',
  /** A discount. */
  sale: 'h-6 bg-pink-500 text-xs text-white',
  /** A fast delivery. */
  express: 'h-6 bg-berry-950 text-xs text-white',
  admin: 'h-5.5 bg-pink-500 text-[11px] text-white',
} as const;

export type BadgeTone = keyof typeof tones;

interface BadgeProps {
  readonly tone: BadgeTone;
  readonly children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.25 rounded-full px-2.25 font-extrabold whitespace-nowrap [&_svg]:size-3.25 [&_svg]:stroke-[2.6] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

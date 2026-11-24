import type { ButtonHTMLAttributes } from 'react';

const sizes = {
  sm: 'h-8.5 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13.5 px-7 text-[17px]',
  xl: 'h-16 px-9 text-[19px]',
} as const;

/** The corners of each size. A pill has fully rounded ends instead. */
const corners = {
  sm: 'rounded-sm',
  md: 'rounded-sm',
  lg: 'rounded-md',
  xl: 'rounded-lg',
} as const;

/** The buttons of the design: "primary" for the main action, the others for the ones next to it. */
const variants = {
  primary: 'border-transparent bg-berry-500 text-white hover:bg-berry-600',
  soft: 'border-transparent bg-berry-100 text-berry-600 hover:bg-berry-200',
  softPink: 'border-transparent bg-pink-100 text-pink-600 hover:bg-pink-200',
  ghost: 'border-transparent bg-transparent text-berry-600 hover:bg-berry-50',
  outline: 'border-gray-300 bg-white text-berry-950 hover:border-berry-300 hover:bg-berry-50',
  dark: 'border-transparent bg-berry-950 text-white hover:bg-berry-900',
  /** An action that refuses or deletes. */
  danger: 'border-transparent bg-red-100 text-red-700 hover:bg-red-500 hover:text-white',
  /** The last step of a flow, on the brand gradient. */
  gradient: 'border-transparent bg-brand text-white hover:brightness-105',
  /** On the brand gradient. */
  white: 'border-transparent bg-white text-berry-700 hover:bg-berry-50',
  /** On a dark or coloured background. */
  outlineWhite: 'border-white/35 bg-transparent text-white hover:bg-white/10',
} as const;

interface ButtonLook {
  readonly size?: keyof typeof sizes;
  readonly variant?: keyof typeof variants;
  /** Fully rounded ends, as on the landing page. */
  readonly pill?: boolean;
}

/** The look of a button. Put it on a link that should look like one. */
export function buttonClasses({
  size = 'md',
  variant = 'primary',
  pill = false,
}: ButtonLook = {}): string {
  return `inline-flex items-center justify-center gap-2 border-[1.5px] font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-berry-500/14 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4.5 ${sizes[size]} ${variants[variant]} ${pill ? 'rounded-full' : corners[size]}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonLook {}

export function Button({
  size,
  variant,
  pill,
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClasses({ size, variant, pill })} ${className}`}
      {...props}
    />
  );
}

/** A small action written as text, for example "Send again" under a code. */
export function TextButton({
  type = 'button',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`rounded-xs text-[13px] font-bold text-berry-500 transition-colors outline-none hover:text-berry-700 focus-visible:ring-4 focus-visible:ring-berry-500/14 disabled:text-gray-400 ${className}`}
      {...props}
    />
  );
}

import type { InputHTMLAttributes } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  /** What the switch turns on. Read by screen readers: the visible text stands next to the switch. */
  readonly label: string;
}

/** The switch of the design: on or off, for a setting that takes effect as one thing. */
export function Toggle({ label, className = '', ...props }: ToggleProps) {
  return (
    <span className={`relative inline-flex h-6.5 w-11 flex-none ${className}`}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        className="peer size-full cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors outline-none checked:bg-berry-500 hover:bg-gray-400 checked:hover:bg-berry-600 focus-visible:ring-4 focus-visible:ring-berry-500/14 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-gray-300"
        {...props}
      />
      <span className="pointer-events-none absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4.5" />
    </span>
  );
}

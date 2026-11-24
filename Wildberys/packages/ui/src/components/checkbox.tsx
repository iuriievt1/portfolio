import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';

/** Where the box stands: on a light page or on a dark one, like the footer of the store. */
const tones = {
  light: {
    box: 'border-gray-300 bg-white hover:border-berry-300',
    label: 'text-gray-600',
  },
  dark: {
    box: 'border-white/35 bg-white/8 hover:border-white/60',
    label: 'text-white/70',
  },
} as const;

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  /** What the person agrees to or chooses. A click on it ticks the box too. It may hold a link. */
  readonly label: ReactNode;
  readonly tone?: keyof typeof tones;
}

/** The "check" box of the design with its label. */
export function Checkbox({ label, tone = 'light', className = '', ...props }: CheckboxProps) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 ${className}`}>
      <span className="relative flex size-5 flex-none">
        <input
          type="checkbox"
          className={`peer size-5 cursor-pointer appearance-none rounded-xs border-[1.8px] transition-colors outline-none checked:border-berry-500 checked:bg-berry-500 checked:hover:border-berry-600 checked:hover:bg-berry-600 focus-visible:ring-4 focus-visible:ring-berry-500/14 ${tones[tone].box}`}
          {...props}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
        />
      </span>
      <span className={`text-sm font-semibold ${tones[tone].label}`}>{label}</span>
    </label>
  );
}

import type { ReactNode } from 'react';

interface FieldProps {
  readonly label: string;
  /** A short line under the field, for example what a password must be like. */
  readonly hint?: string;
  readonly className?: string;
  /** The box of the field, with the classes from fieldBoxClasses. */
  readonly children: ReactNode;
}

/** What every field of a form has around its box: the label above it and a hint under it. */
export function Field({ label, hint, className = '', children }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-bold text-gray-700">{label}</span>
      {children}
      {hint ? <span className="text-[12.5px] font-medium text-gray-600">{hint}</span> : null}
    </label>
  );
}

/** The frame of a box: its border, and the ring it gets while the person is in it. */
const fieldFrameClasses =
  'rounded-sm border-[1.5px] border-gray-300 bg-white transition-shadow focus-within:border-berry-500 focus-within:ring-4 focus-within:ring-berry-500/14';

/** The box a person types or chooses in. An icon inside it is drawn small and gray. */
export const fieldBoxClasses = `flex h-12 items-center gap-2.5 px-3.5 [&_svg]:size-4.5 [&_svg]:text-gray-400 ${fieldFrameClasses}`;

/** The box of a text of several lines. It is as tall as its lines. */
export const fieldAreaClasses = `flex ${fieldFrameClasses}`;

/** The text a person typed or chose. */
export const fieldTextClasses = 'text-[15px] font-medium text-berry-950 outline-none';

import type { ReactNode } from 'react';

interface FactsProps {
  readonly className?: string;
  /** The facts, each a Fact. */
  readonly children: ReactNode;
}

/**
 * Facts about one thing, each with its name: the name on the left and the fact next to it.
 * In a narrow place the fact goes under its name. The place is the nearest container.
 */
export function Facts({ className = '', children }: FactsProps) {
  return <dl className={`flex flex-col gap-2.5 text-sm ${className}`}>{children}</dl>;
}

interface FactProps {
  /** What the fact is, for example "Country". */
  readonly label: string;
  readonly children: ReactNode;
}

export function Fact({ label, children }: FactProps) {
  return (
    <div className="flex flex-col gap-0.5 @lg:flex-row @lg:gap-4">
      <dt className="flex-none font-semibold text-gray-600 @lg:w-48">{label}</dt>
      <dd className="min-w-0 font-bold break-words">{children}</dd>
    </div>
  );
}

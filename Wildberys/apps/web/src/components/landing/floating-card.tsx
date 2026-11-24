import type { ReactNode } from 'react';

const sizes = {
  sm: 'rounded-md px-3 py-2.5',
  md: 'rounded-lg px-4 py-3.5',
} as const;

interface FloatingCardProps {
  readonly size?: keyof typeof sizes;
  /** Where the card stands and how its content is laid out. */
  readonly className: string;
  readonly children: ReactNode;
}

/** A small white card that floats over a picture: an express delivery, a courier on the way. */
export function FloatingCard({ size = 'md', className, children }: FloatingCardProps) {
  return (
    <div className={`absolute z-8 bg-white text-berry-950 shadow-lg ${sizes[size]} ${className}`}>
      {children}
    </div>
  );
}

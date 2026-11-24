import { CarIcon, HouseIcon, StorefrontIcon } from '@phosphor-icons/react/ssr';

const marks = {
  store: { look: 'bg-white text-berry-600', icon: <StorefrontIcon weight="fill" /> },
  courier: { look: 'bg-berry-950 text-white', icon: <CarIcon weight="fill" /> },
  home: { look: 'bg-pink-500 text-white', icon: <HouseIcon weight="fill" /> },
} as const;

interface MapMarkProps {
  readonly kind: keyof typeof marks;
  /** Where the mark stands, and its size. */
  readonly className: string;
}

/** A round mark on a drawn map: the store, the courier's car or the home of the buyer. */
export function MapMark({ kind, className }: MapMarkProps) {
  return (
    <span
      className={`flex items-center justify-center rounded-full border-3 border-white ring-1 ring-berry-800/10 [&_svg]:size-5.5 ${marks[kind].look} ${className}`}
    >
      {marks[kind].icon}
    </span>
  );
}

/** Puts the middle of a mark at a point of the map. */
export const onMap = 'absolute z-3 -translate-1/2';

import { Children, ViewTransition, type ReactNode } from 'react';

/** The space around the options, in rem, and the classes of one option. */
const sizes = {
  sm: { padding: 0.1875, box: 'p-0.75', option: 'h-6.5 min-w-9.5 px-2.5 text-xs' },
  md: { padding: 0.25, box: 'p-1', option: 'h-8.5 px-3.5 text-[13px]' },
} as const;

export type SegmentedSize = keyof typeof sizes;

interface SegmentedProps {
  readonly size: SegmentedSize;
  /** Which option is chosen now, counted from zero. */
  readonly activeIndex: number;
  /**
   * Set when choosing an option draws the whole page anew, like a change of language:
   * the thumb then slides from its place on the old page to its place on the new one.
   */
  readonly transitionName?: string;
  /** Set together with the label when the options are radio buttons. */
  readonly role?: 'radiogroup';
  /** What is being chosen, for screen readers. */
  readonly label?: string;
  /** The options: links or buttons with the classes from segmentedOptionClasses. */
  readonly children: ReactNode;
}

/**
 * A choice between a few options shown side by side, the "seg" control of the design.
 * A white thumb marks the chosen option and slides to the next one.
 */
export function Segmented({
  size,
  activeIndex,
  transitionName,
  role,
  label,
  children,
}: SegmentedProps) {
  const { padding, box } = sizes[size];
  const thumb = (
    <span
      aria-hidden
      className="pointer-events-none absolute rounded-xs bg-white shadow-sm transition-transform duration-200 ease-out"
      style={{
        top: `${String(padding)}rem`,
        bottom: `${String(padding)}rem`,
        left: `${String(padding)}rem`,
        width: `calc((100% - ${String(2 * padding)}rem) / ${String(Children.count(children))})`,
        transform: `translateX(${String(activeIndex * 100)}%)`,
      }}
    />
  );

  return (
    <div
      role={role}
      aria-label={label}
      className={`relative inline-grid flex-none auto-cols-fr grid-flow-col rounded-sm bg-gray-100 ${box}`}
    >
      {transitionName ? (
        <ViewTransition name={transitionName} share="auto" default="none">
          {thumb}
        </ViewTransition>
      ) : (
        thumb
      )}
      {children}
    </div>
  );
}

/** Classes for one option. Each place puts them on its own link or button. */
export function segmentedOptionClasses(size: SegmentedSize, active: boolean): string {
  return `relative flex items-center justify-center rounded-xs font-bold transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-berry-500/14 disabled:pointer-events-none disabled:text-gray-400 ${sizes[size].option} ${
    active ? 'text-berry-950' : 'text-gray-600 hover:text-berry-950'
  }`;
}

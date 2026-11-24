import { BatteryFullIcon, CellSignalFullIcon, WifiHighIcon } from '@phosphor-icons/react/ssr';
import type { ReactNode } from 'react';

interface PhoneProps {
  /** How large the phone is drawn: a "zoom" of its full size. */
  readonly className: string;
  /** Set when the place that shows the phone turns it in space: its side then shows as a metal edge. */
  readonly turned?: boolean;
  readonly children: ReactNode;
}

const sideButton = 'absolute w-1 bg-phone-button';

/**
 * A phone drawn to look like a real one: a titanium band with its buttons, black glass,
 * the island with the camera and a shine across the screen. It is 414 by 868 with a screen
 * of 390 by 844 inside. Everything on the screen is a picture of the future app, so the block
 * that shows the phone hides it from screen readers.
 */
export function Phone({ className, turned = false, children }: PhoneProps) {
  return (
    <div className={`relative h-217 w-103.5 flex-none ${className}`}>
      {/* The action button and the two volume buttons on the left, the side button on the right. */}
      <span className={`${sideButton} top-42 -left-0.75 h-8 rounded-l-xs`} />
      <span className={`${sideButton} top-56 -left-0.75 h-15 rounded-l-xs`} />
      <span className={`${sideButton} top-74 -left-0.75 h-15 rounded-l-xs`} />
      <span className={`${sideButton} top-64 -right-0.75 h-24 rounded-r-xs`} />
      <div
        className={`relative size-full rounded-phone bg-phone-band p-0.75 ${turned ? 'shadow-phone-turned' : 'shadow-phone'}`}
      >
        <div className="size-full rounded-phone bg-phone-body p-2.25">
          <div className="relative flex size-full flex-col overflow-hidden rounded-phone-screen bg-white text-berry-950">
            <span className="absolute top-2.75 left-1/2 z-50 flex h-9 w-31 -translate-x-1/2 items-center justify-end rounded-full bg-phone-body pr-3">
              <span className="size-2.5 rounded-full bg-berry-900/70 ring-1 ring-white/10" />
            </span>
            {children}
            <span className="absolute bottom-2 left-1/2 z-60 h-1.25 w-33.5 -translate-x-1/2 rounded-full bg-berry-950" />
            <span className="pointer-events-none absolute inset-0 z-70 bg-phone-glass" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The top line of the phone's screen: the clock and the signal. */
export function StatusBar() {
  return (
    <div className="relative z-40 flex h-13.5 flex-none items-center justify-between pt-1.5 pr-7.5 pl-10 text-base font-bold">
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <CellSignalFullIcon weight="fill" className="size-4.5" />
        <WifiHighIcon weight="bold" className="size-4.5" />
        <BatteryFullIcon weight="fill" className="size-6.5" />
      </span>
    </div>
  );
}

import type { ReactNode } from 'react';

import { Logo } from './logo';

interface Benefit {
  readonly icon: ReactNode;
  readonly label: string;
}

interface SignInLayoutProps {
  /** The large text on the brand panel. */
  readonly panelTitle: string;
  readonly benefits?: readonly Benefit[];
  /** Shown in the top right corner above the form, for example a language switch. */
  readonly headerAction?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The split screen of the seller registration from design 02: the brand panel on the left,
 * the form on the right. On narrow screens only the form is shown.
 */
export function SignInLayout({
  panelTitle,
  benefits = [],
  headerAction,
  children,
}: SignInLayoutProps) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-115 flex-none flex-col bg-panel px-11 pt-11 pb-9 text-white lg:flex">
        <Logo tone="white" mark="white" className="text-[40px]" />
        <p className="mt-14 text-[38px] leading-[1.08] font-extrabold tracking-[-0.025em] text-balance">
          {panelTitle}
        </p>
        <ul className="mt-8.5 flex flex-col gap-4">
          {benefits.map(({ icon, label }) => (
            <li key={label} className="flex items-center gap-3.5 text-[17px] font-bold">
              <span className="flex size-10 flex-none items-center justify-center rounded-sm bg-white/18 [&_svg]:size-5">
                {icon}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col px-6 py-8.5 sm:px-14">
        <div className="flex min-h-9 items-center justify-between gap-4 lg:justify-end">
          <Logo className="text-[28px] lg:hidden" />
          {headerAction}
        </div>
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from 'react';

/** The seller portal has a light sidebar, the admin a dark one. */
export type SidebarTone = 'light' | 'dark';

const sidebarTones = {
  light: 'w-62 border-r border-gray-200 bg-white px-3.5 py-5',
  dark: 'w-59 bg-berry-950 px-3 py-4.5',
} as const;

const navTones = {
  light: 'mt-5.5',
  dark: 'mt-3.5',
} as const;

const groupLabelTones = {
  light: 'px-3 pt-4 pb-1.5 text-[11px] text-gray-400',
  dark: 'px-3 pt-3 pb-1 text-[10.5px] text-white/35',
} as const;

const itemTones = {
  light: {
    base: 'h-10.5 gap-3 text-[14.5px] [&_svg]:size-4.75',
    idle: 'text-gray-700 hover:bg-gray-100 [&_svg]:text-gray-600',
    active: 'bg-berry-100 text-berry-600 [&_svg]:text-berry-500',
  },
  dark: {
    base: 'h-9 gap-2.75 text-[13.5px] [&_svg]:size-4.25',
    idle: 'text-white/72 hover:bg-white/8 hover:text-white [&_svg]:text-white/55',
    active: 'bg-berry-500/28 text-white [&_svg]:text-pink-300',
  },
} as const;

interface AppShellProps {
  readonly sidebar: ReactNode;
  readonly topbar: ReactNode;
  readonly children: ReactNode;
}

/** The frame of a signed-in app: a sidebar on the left, a top bar and the page. */
export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="flex flex-1 flex-col gap-5 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}

interface SidebarProps {
  readonly tone: SidebarTone;
  /** The logo and the badge of the app. */
  readonly header: ReactNode;
  readonly children: ReactNode;
  /** Stays at the bottom, for example the signed-in person. */
  readonly footer?: ReactNode;
}

export function Sidebar({ tone, header, children, footer }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 flex h-screen flex-none flex-col overflow-y-auto ${sidebarTones[tone]}`}
    >
      <div className="flex items-center justify-between px-2 pt-0.5">{header}</div>
      {children}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </aside>
  );
}

interface SidebarSectionProps {
  readonly tone: SidebarTone;
  /** The name of a group of links. The first group of a sidebar has none. */
  readonly label?: string;
  readonly children: ReactNode;
}

/** A group of links in the sidebar. */
export function SidebarSection({ tone, label, children }: SidebarSectionProps) {
  return (
    <>
      {label ? (
        <div className={`font-extrabold tracking-[0.12em] uppercase ${groupLabelTones[tone]}`}>
          {label}
        </div>
      ) : null}
      <nav className={`flex flex-col gap-0.5 ${label ? '' : navTones[tone]}`}>{children}</nav>
    </>
  );
}

/** Classes for a link in the sidebar. Each app puts them on its own link component. */
export function sidebarItemClasses(tone: SidebarTone, active: boolean): string {
  const item = itemTones[tone];

  return `flex items-center rounded-sm px-3 font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-berry-500/14 ${item.base} ${active ? item.active : item.idle}`;
}

export function Topbar({ children }: { readonly children: ReactNode }) {
  return (
    <header className="flex h-17 flex-none items-center justify-end gap-4 border-b border-gray-200 bg-white px-7">
      {children}
    </header>
  );
}

export function PageTitle({ children }: { readonly children: ReactNode }) {
  return <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{children}</h1>;
}

'use client';

import { sidebarItemClasses } from '@bluberi/ui/components/app-shell';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import type { ReactNode } from 'react';

import type { Section } from '../sections';

export interface PanelNavLink {
  readonly path: Section['path'];
  readonly label: string;
  readonly icon: ReactNode;
  /** Shown at the end of the link, for example how many messages wait. */
  readonly badge?: ReactNode;
}

/** Links of the sidebar. The one for the open section is highlighted. */
export function PanelNavLinks({ links }: { readonly links: readonly PanelNavLink[] }) {
  const openPath = `/${useSelectedLayoutSegments().join('/')}`;

  return links.map(({ path, label, icon, badge }) => {
    // A page under a section, like the card of a seller, belongs to the section.
    const active = openPath === path || openPath.startsWith(`${path}/`);

    return (
      <Link
        key={path}
        href={path}
        aria-current={active ? 'page' : undefined}
        className={sidebarItemClasses('dark', active)}
      >
        {icon}
        {label}
        {badge}
      </Link>
    );
  });
}

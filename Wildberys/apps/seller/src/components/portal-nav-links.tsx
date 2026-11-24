'use client';

import { sidebarItemClasses } from '@bluberi/ui/components/app-shell';
import type { Route } from 'next';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import type { Section } from '../sections';

export interface PortalNavLink {
  readonly section: Section;
  /** The address of the section with the language in front where it is needed. */
  readonly href: Route;
  readonly label: string;
  readonly icon: ReactNode;
  /** Shown at the end of the link, for example how many messages wait. */
  readonly badge?: ReactNode;
}

interface NavLinksProps {
  readonly links: readonly PortalNavLink[];
}

/** Links of the sidebar. The one for the open section is highlighted. */
export function PortalNavLinks({ links }: NavLinksProps) {
  return (
    // A page with an id in its address is prepared before the id is known, and with it the open
    // section. There the links are drawn plain first, and the open one is marked a moment later.
    <Suspense fallback={<NavLinks links={links} openSection={null} />}>
      <NavLinksOfOpenSection links={links} />
    </Suspense>
  );
}

function NavLinksOfOpenSection({ links }: NavLinksProps) {
  return <NavLinks links={links} openSection={useSelectedLayoutSegment()} />;
}

function NavLinks({ links, openSection }: NavLinksProps & { readonly openSection: string | null }) {
  return links.map(({ section, href, label, icon, badge }) => {
    const active = section === openSection;

    return (
      <Link
        key={section}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={sidebarItemClasses('light', active)}
      >
        {icon}
        {label}
        {badge}
      </Link>
    );
  });
}

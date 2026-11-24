import { AppShell, Sidebar, SidebarSection, Topbar } from '@bluberi/ui/components/app-shell';
import { Badge } from '@bluberi/ui/components/badge';
import { LiveRefresh } from '@bluberi/ui/components/live-refresh';
import { Logo } from '@bluberi/ui/components/logo';
import { SignOutButton } from '@bluberi/ui/components/sign-out-button';
import { UserBadge } from '@bluberi/ui/components/user-badge';
import { displayName } from '@bluberi/web-auth/session';
import {
  FolderTree,
  Flag,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  PackageSearch,
  Percent,
  Scale,
  ScrollText,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { liveEventsPath, signOutPath } from '../../auth/config';
import { getUser } from '../../auth/current-user';
import { NoAccess } from '../../components/no-access';
import { PanelNavLinks, type PanelNavLink } from '../../components/panel-nav-links';
import { UnreadConversationsBadge } from '../../components/unread-conversations-badge';
import { groups, visibleSections, type Group, type Section } from '../../sections';

/** The icons of the menu in design 04. */
const sectionIcons: Record<Section['key'], LucideIcon> = {
  overview: LayoutDashboard,
  sellers: Store,
  products: PackageSearch,
  dsaNotices: Flag,
  supportTickets: MessagesSquare,
  disputesAndReturns: Scale,
  payouts: Wallet,
  commissions: Percent,
  logistics: Truck,
  catalog: FolderTree,
  marketing: Megaphone,
  roles: ShieldCheck,
  auditLog: ScrollText,
};

export default function PanelLayout({ children }: LayoutProps<'/'>) {
  // The frame depends on who is signed in, so it waits for the session and streams in.
  return (
    <Suspense fallback={null}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  );
}

async function PanelFrame({ children }: { readonly children: ReactNode }) {
  const user = await getUser();

  if (!user) {
    // The cookies are still there but the session has ended. The sign-out route removes them.
    redirect(signOutPath);
  }

  if (user.platformRoles.length === 0) {
    return <NoAccess />;
  }

  const t = await getTranslations();
  const name = displayName(user);
  const roles = user.platformRoles.map((role) => t(`roles.${role}`)).join(', ');
  const allowed = visibleSections(user.platformAccess);
  const links = (group: Group | null): PanelNavLink[] =>
    allowed
      .filter((section) => section.group === group)
      .map(({ key, path }) => {
        const Icon = sectionIcons[key];

        return {
          path,
          label: t(`nav.items.${key}`),
          icon: <Icon />,
          // How many messages wait depends on the request, so the number streams in.
          badge:
            key === 'supportTickets' ? (
              <Suspense fallback={null}>
                <UnreadConversationsBadge />
              </Suspense>
            ) : undefined,
        };
      });

  return (
    <AppShell
      sidebar={
        <Sidebar
          tone="dark"
          header={
            <>
              <Logo tone="white" className="text-2xl" />
              <Badge tone="admin">{t('badge')}</Badge>
            </>
          }
          footer={
            <div className="border-t border-white/8 px-2 pt-2.5 pb-0.5">
              <UserBadge tone="dark" name={name} detail={roles} />
            </div>
          }
        >
          <SidebarSection tone="dark">
            <PanelNavLinks links={links(null)} />
          </SidebarSection>
          {groups.map((group) => {
            const groupLinks = links(group);

            return groupLinks.length > 0 ? (
              <SidebarSection key={group} tone="dark" label={t(`nav.groups.${group}`)}>
                <PanelNavLinks links={groupLinks} />
              </SidebarSection>
            ) : null;
          })}
        </Sidebar>
      }
      topbar={
        <Topbar>
          <UserBadge tone="light" name={name} detail={roles} />
          <SignOutButton label={t('shell.signOut')} href={signOutPath} />
        </Topbar>
      }
    >
      {/* What sellers and colleagues change is on the open page at once, whatever section it is. */}
      <LiveRefresh url={liveEventsPath} />
      {children}
    </AppShell>
  );
}

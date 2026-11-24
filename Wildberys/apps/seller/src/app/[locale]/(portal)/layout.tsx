import { AppShell, Sidebar, SidebarSection, Topbar } from '@bluberi/ui/components/app-shell';
import { Badge } from '@bluberi/ui/components/badge';
import { LiveRefresh } from '@bluberi/ui/components/live-refresh';
import { Logo } from '@bluberi/ui/components/logo';
import { SignOutButton } from '@bluberi/ui/components/sign-out-button';
import {
  BarChart3,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Package,
  Shirt,
  Star,
  Store,
  Undo2,
  Upload,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { liveEventsPath, signOutPath } from '../../../auth/config';
import { LanguageSwitcher } from '../../../components/language-switcher';
import { PortalNavLinks, type PortalNavLink } from '../../../components/portal-nav-links';
import { ReviewBanner } from '../../../components/review-banner';
import { TopbarAccount, TopbarAccountPlaceholder } from '../../../components/topbar-account';
import { UnreadMessagesBadge } from '../../../components/unread-messages-badge';
import { localizedPath } from '../../../i18n/paths';
import { mainSections, settingsSections, type Section } from '../../../sections';

/** The icons of the menu in design 02. */
const sectionIcons: Record<Section, LucideIcon> = {
  prehled: LayoutDashboard,
  zpravy: MessagesSquare,
  objednavky: Package,
  produkty: Shirt,
  import: Upload,
  finance: Wallet,
  vraceni: Undo2,
  hodnoceni: Star,
  propagace: Megaphone,
  analytika: BarChart3,
  obchod: Store,
  tym: Users,
  napoveda: LifeBuoy,
};

/**
 * The frame of the portal. The menu and the top bar are the same for everyone, so they are
 * drawn at once. Only the signed-in person waits for the session and streams in.
 */
export default async function PortalLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();
  const t = await getTranslations();
  const links = (sections: readonly Section[]): PortalNavLink[] =>
    sections.map((section) => {
      const Icon = sectionIcons[section];

      return {
        section,
        href: localizedPath(`/${section}`, locale),
        label: t(`nav.items.${section}`),
        icon: <Icon />,
        // How many messages wait depends on the request, so the number streams in.
        badge:
          section === 'zpravy' ? (
            <Suspense fallback={null}>
              <UnreadMessagesBadge />
            </Suspense>
          ) : undefined,
      };
    });

  return (
    <AppShell
      sidebar={
        <Sidebar
          tone="light"
          header={
            <>
              <Logo className="text-[26px]" />
              <Badge tone="violet">{t('badge')}</Badge>
            </>
          }
        >
          <SidebarSection tone="light">
            <PortalNavLinks links={links(mainSections)} />
          </SidebarSection>
          <SidebarSection tone="light" label={t('nav.settings')}>
            <PortalNavLinks links={links(settingsSections)} />
          </SidebarSection>
        </Sidebar>
      }
      topbar={
        <Topbar>
          {/* First in the row: the person takes room to the left, and the buttons after them stay where they are. */}
          <Suspense fallback={<TopbarAccountPlaceholder />}>
            <TopbarAccount />
          </Suspense>
          <LanguageSwitcher label={t('shell.language')} />
          <SignOutButton label={t('shell.signOut')} href={localizedPath(signOutPath, locale)} />
        </Topbar>
      }
    >
      {/* A message, a decision of the team or a change by a colleague is on the open page at once. */}
      <LiveRefresh url={localizedPath(liveEventsPath, locale)} />
      {/* Whether the seller is approved depends on the request, so the line about it streams in. */}
      <Suspense fallback={null}>
        <ReviewBanner locale={locale} />
      </Suspense>
      {children}
    </AppShell>
  );
}

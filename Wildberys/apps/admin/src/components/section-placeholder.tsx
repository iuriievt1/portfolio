import { PageTitle } from '@bluberi/ui/components/app-shell';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getUser } from '../auth/current-user';
import { sections, type Section } from '../sections';

/** A section of the admin that is not built yet: its name and a note. The real page replaces it. */
export function SectionPlaceholder({ section }: { readonly section: Section['key'] }) {
  // Whether the person may open the section depends on who is signed in, so it streams in.
  return (
    <Suspense fallback={null}>
      <SectionContent sectionKey={section} />
    </Suspense>
  );
}

async function SectionContent({ sectionKey }: { readonly sectionKey: Section['key'] }) {
  const user = await getUser();
  const t = await getTranslations();
  const section = sections.find(({ key }) => key === sectionKey);

  // The menu hides the sections a person may not open. This covers a link typed by hand.
  if (!user || !section || user.platformAccess[section.area] === 'none') {
    return <PageTitle>{t('shell.noAccessTitle')}</PageTitle>;
  }

  return (
    <>
      <PageTitle>{t(`nav.items.${section.key}`)}</PageTitle>
      <p className="text-sm font-semibold text-gray-600">{t('shell.comingSoon')}</p>
    </>
  );
}

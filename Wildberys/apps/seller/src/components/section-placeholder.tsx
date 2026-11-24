import { PageTitle } from '@bluberi/ui/components/app-shell';
import { getTranslations } from 'next-intl/server';

import type { Section } from '../sections';

/** A section of the portal that is not built yet: its name and a note. The real page replaces it. */
export async function SectionPlaceholder({ section }: { readonly section: Section }) {
  const t = await getTranslations();

  return (
    <>
      <PageTitle>{t(`nav.items.${section}`)}</PageTitle>
      <p className="text-sm font-semibold text-gray-600">{t('shell.comingSoon')}</p>
    </>
  );
}

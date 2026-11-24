import { buttonClasses } from '@bluberi/ui/components/button';
import { Clock3, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { requestedDocumentsPath } from '../auth/config';
import { localizedPath } from '../i18n/paths';
import { getRegistration } from '../registration/registration';

/**
 * A line at the top of every page of the portal for a seller the team has not approved yet:
 * the registration is being checked, or the team waits for documents. An approved seller sees nothing.
 */
export async function ReviewBanner({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const t = await getTranslations('review');
  const status = registration?.seller?.status;

  if (status === 'PENDING_REVIEW') {
    return (
      <p className="flex items-center gap-3 rounded-md bg-amber-100 px-4 py-3 text-sm font-bold text-amber-700 [&_svg]:size-4.5 [&_svg]:flex-none">
        <Clock3 />
        {t('pending')}
      </p>
    );
  }

  if (status === 'DOCUMENTS_REQUESTED') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md bg-berry-100 px-4 py-3 text-sm font-bold text-berry-950 [&>svg]:size-4.5 [&>svg]:flex-none [&>svg]:text-berry-600">
        <FileWarning />
        <span className="min-w-0 flex-1 basis-56">{t('documentsRequested')}</span>
        <Link
          href={localizedPath(requestedDocumentsPath, locale)}
          className={buttonClasses({ size: 'sm' })}
        >
          {t('addDocuments')}
        </Link>
      </div>
    );
  }

  return null;
}

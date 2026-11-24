import { operator } from '@bluberi/i18n/operator';
import { CircleX, PauseCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PlainPage } from '../../../components/plain-page';
import { getRegistration } from '../../../registration/registration';

/** What a seller sees in place of the portal after the team refused or stopped them. */
export default async function ReviewOutcomePage({ params }: PageProps<'/[locale]/stav'>) {
  const { locale } = await params;

  return (
    <PlainPage locale={locale} centered>
      {/* The decision depends on the request, so it streams in. */}
      <Suspense fallback={null}>
        <Outcome />
      </Suspense>
    </PlainPage>
  );
}

async function Outcome() {
  const registration = await getRegistration();
  const t = await getTranslations('review');
  const seller = registration?.seller;

  // The proxy sends here only the owner of a seller the team refused or stopped.
  if (!seller) {
    return null;
  }

  const refused = seller.status === 'REJECTED';

  return (
    <>
      <span className="flex size-18 items-center justify-center rounded-full bg-pink-100 text-pink-600 [&_svg]:size-9">
        {refused ? <CircleX /> : <PauseCircle />}
      </span>
      <h1 className="mt-6 text-[clamp(1.5rem,6vw,2rem)] leading-tight font-extrabold tracking-[-0.02em]">
        {refused ? t('rejectedTitle') : t('suspendedTitle')}
      </h1>
      <p className="mt-1.5 text-[15px] font-semibold text-gray-600">{seller.company.legalName}</p>
      {seller.reviewMessage ? (
        <div className="mt-6 flex w-full flex-col gap-1.5 rounded-md border border-gray-200 bg-white px-4 py-3.5 text-left">
          <span className="text-[13px] font-bold text-gray-700">{t('reasonLabel')}</span>
          <p className="text-[15px] font-medium break-words whitespace-pre-line">
            {seller.reviewMessage}
          </p>
        </div>
      ) : null}
      <p className="mt-5 text-sm font-medium text-gray-600">
        {t('contact')}{' '}
        <a
          href={`mailto:${operator.supportEmail}`}
          className="rounded-xs font-bold text-berry-600 transition-colors outline-none hover:text-berry-700 focus-visible:ring-4 focus-visible:ring-berry-500/14"
        >
          {operator.supportEmail}
        </a>
      </p>
    </>
  );
}

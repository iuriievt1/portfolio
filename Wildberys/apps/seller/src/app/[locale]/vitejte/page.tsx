import { Badge } from '@bluberi/ui/components/badge';
import { buttonClasses } from '@bluberi/ui/components/button';
import { Logo } from '@bluberi/ui/components/logo';
import { Check, Clock3, Plus, Rocket, Shirt, Upload } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';

import { localizedPath } from '../../../i18n/paths';
import { getRegistration } from '../../../registration/registration';

/** How far a line of the list is: done, running, or still ahead. */
type Progress = 'done' | 'running' | 'ahead';

const marks: Record<Progress, string> = {
  done: 'bg-green-100 text-green-500 [&_svg]:stroke-3',
  running: 'bg-amber-100 text-amber-500',
  ahead: 'bg-gray-100 text-gray-400',
};

function Row({
  icon,
  progress,
  title,
  badge,
}: {
  readonly icon: ReactNode;
  readonly progress: Progress;
  readonly title: string;
  readonly badge: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-gray-200 py-3 text-[14.5px] font-bold last:border-b-0">
      <span
        className={`flex size-7 flex-none items-center justify-center rounded-full [&_svg]:size-4 ${marks[progress]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{title}</span>
      {badge}
    </li>
  );
}

/** The last page of the seller registration from design 02: what is done and what comes next. */
export default async function WelcomePage({ params }: PageProps<'/[locale]/vitejte'>) {
  const { locale } = await params;
  const t = await getTranslations('welcome');

  return (
    <main className="flex min-h-screen flex-col bg-soft px-6 py-7 sm:px-10">
      <Logo className="text-[30px]" />
      <div className="mx-auto flex w-full max-w-140 flex-1 animate-step-in flex-col items-center justify-center py-10 text-center">
        <span className="flex size-22 items-center justify-center rounded-full bg-brand text-white sm:size-27.5 [&_svg]:size-11 [&_svg]:stroke-[2.6] sm:[&_svg]:size-14">
          <Check />
        </span>
        <h1 className="mt-6.5 text-[32px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[40px]">
          {t('title')}
        </h1>
        <p className="mt-2 text-base font-semibold text-balance text-gray-600">{t('text')}</p>
        <ul className="mt-6 w-full rounded-lg border border-gray-200 bg-white px-5 py-2 text-left shadow-sm">
          <Row
            icon={<Check />}
            progress="done"
            title={t('account')}
            badge={<Badge tone="green">{t('done')}</Badge>}
          />
          {/* The check of the payment provider depends on the request, so its line streams in. */}
          <Suspense
            fallback={
              <Row
                icon={<Clock3 />}
                progress="running"
                title={t('identity')}
                badge={<Badge tone="amber">{t('inProgress')}</Badge>}
              />
            }
          >
            <IdentityRow />
          </Suspense>
          <Row
            icon={<Shirt />}
            progress="ahead"
            title={t('products')}
            badge={<Badge tone="violet">{t('nextStep')}</Badge>}
          />
          <Row
            icon={<Rocket />}
            progress="ahead"
            title={t('launch')}
            badge={<Badge tone="violet">{t('afterCheck')}</Badge>}
          />
        </ul>
        <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={localizedPath('/produkty', locale)}
            className={buttonClasses({ size: 'lg', variant: 'primary' })}
          >
            <Plus />
            {t('addProduct')}
          </Link>
          <Link
            href={localizedPath('/import', locale)}
            className={buttonClasses({ size: 'lg', variant: 'outline' })}
          >
            <Upload />
            {t('importCatalog')}
          </Link>
        </div>
      </div>
    </main>
  );
}

async function IdentityRow() {
  const t = await getTranslations('welcome');
  const registration = await getRegistration();
  const verified = registration?.seller?.payoutAccount?.status === 'VERIFIED';

  return (
    <Row
      icon={verified ? <Check /> : <Clock3 />}
      progress={verified ? 'done' : 'running'}
      title={t('identity')}
      badge={
        <Badge tone={verified ? 'green' : 'amber'}>{t(verified ? 'done' : 'inProgress')}</Badge>
      }
    />
  );
}

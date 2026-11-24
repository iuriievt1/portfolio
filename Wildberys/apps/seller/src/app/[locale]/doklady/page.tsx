import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { homePath } from '../../../auth/config';
import { PlainPage } from '../../../components/plain-page';
import { secondaryLink } from '../../../components/registration/step-frame';
import { RequestedDocuments } from '../../../components/requested-documents';
import { localizedPath } from '../../../i18n/paths';
import { addDocument, removeDocument, resubmitRegistration } from '../../../registration/actions';
import { getRegistration } from '../../../registration/registration';

/**
 * Where a seller answers a request of the team for documents. It stands outside the menu of the portal:
 * one thing to do, in one narrow column.
 */
export default async function RequestedDocumentsPage({ params }: PageProps<'/[locale]/doklady'>) {
  const { locale } = await params;

  return (
    <PlainPage locale={locale}>
      {/* What the team asked for depends on the request, so the page streams in. */}
      <Suspense fallback={null}>
        <Requested locale={locale} />
      </Suspense>
    </PlainPage>
  );
}

async function Requested({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const messages = await getMessages();
  const seller = registration?.seller;
  const home = localizedPath(homePath, locale);

  // The page is only for a seller the team waits for. Anybody else has nothing to do here.
  if (seller?.status !== 'DOCUMENTS_REQUESTED' || seller.reviewMessage === null) {
    redirect(home);
  }

  return (
    <>
      <h1 className="text-[clamp(1.375rem,6vw,1.75rem)] leading-tight font-extrabold tracking-[-0.02em]">
        {messages.review.requestedTitle}
      </h1>
      <RequestedDocuments
        message={seller.reviewMessage}
        documents={seller.documents}
        locale={locale}
        labels={{
          kinds: messages.registration.documents.kinds,
          upload: messages.registration.documents.upload,
          remove: messages.registration.documents.remove,
          messageLabel: messages.review.messageLabel,
          send: messages.review.send,
        }}
        errors={messages.errors}
        doneHref={home}
        add={addDocument}
        remove={removeDocument}
        resubmit={resubmitRegistration}
      />
      <div className="mt-4 flex justify-center text-sm">
        <Link href={home} className={secondaryLink}>
          <ArrowLeft />
          {messages.review.toPortal}
        </Link>
      </div>
    </>
  );
}

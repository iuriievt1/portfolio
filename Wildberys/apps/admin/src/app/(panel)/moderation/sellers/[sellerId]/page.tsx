import type { ModeratedSeller } from '@bluberi/api-client';
import { PageTitle } from '@bluberi/ui/components/app-shell';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { getMessages, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getUser } from '../../../../../auth/current-user';
import { CardNote, CardSection } from '../../../../../components/card-section';
import {
  RegisterCheckBadge,
  RegisterCheckDetails,
} from '../../../../../components/sellers/register-check';
import { SellerCompany } from '../../../../../components/sellers/seller-company';
import { SellerContacts } from '../../../../../components/sellers/seller-contacts';
import { SellerDecision } from '../../../../../components/sellers/seller-decision';
import { SellerDocuments } from '../../../../../components/sellers/seller-documents';
import { SellerHistory } from '../../../../../components/sellers/seller-history';
import { SellerMessages } from '../../../../../components/sellers/seller-messages';
import { SellerPayouts } from '../../../../../components/sellers/seller-payouts';
import { SellerStore } from '../../../../../components/sellers/seller-store';
import { SellerSummary } from '../../../../../components/sellers/seller-summary';
import { SellerTraceabilityList } from '../../../../../components/sellers/seller-traceability';
import { textLinkClasses } from '../../../../../components/text-link';
import {
  approveSeller,
  rejectSeller,
  removeSellerDraft,
  reopenSeller,
  requestSellerDocuments,
} from '../../../../../sellers/actions';
import { homeCountry } from '../../../../../sellers/address';
import {
  decisionMessageMaxLength,
  decisionMessageMinLength,
} from '../../../../../sellers/decision-message';
import { isId } from '../../../../../sellers/ids';
import { getSeller } from '../../../../../sellers/moderation';
import { sellersPath, sellerTabPath } from '../../../../../sellers/paths';
import { writesToSellers } from '../../../../../support/inbox';

/** The card of a seller: everything the team decides by, and the decision. */
export default function SellerPage({ params }: PageProps<'/moderation/sellers/[sellerId]'>) {
  // Who may open the card and what it holds depend on the request, so the page streams in.
  return (
    <Suspense fallback={null}>
      <SellerCard params={params} />
    </Suspense>
  );
}

async function SellerCard({ params }: Pick<PageProps<'/moderation/sellers/[sellerId]'>, 'params'>) {
  const user = await getUser();
  const t = await getTranslations();

  // The menu hides the section from people who may not open it. This covers a link typed by hand.
  if (!user || user.platformAccess.sellers === 'none') {
    return <PageTitle>{t('shell.noAccessTitle')}</PageTitle>;
  }

  const { sellerId } = await params;

  // An address typed by hand may hold anything. The API is asked only with an id.
  if (!isId(sellerId)) {
    notFound();
  }

  const seller = await getSeller(sellerId);

  return (
    // One column of blocks. What is inside them goes by the width of the column, not of the screen.
    <div className="@container flex w-full max-w-4xl flex-col gap-5">
      <Link
        href={sellersPath}
        className={`inline-flex items-center gap-1.5 self-start text-sm [&_svg]:size-4 ${textLinkClasses}`}
      >
        <ArrowLeft />
        {t('sellers.card.back')}
      </Link>
      {seller ? (
        <>
          <SellerSummary seller={seller} />
          <SellerCompany company={seller.company} />
          {/* The registers answer in their own time, so the rest of the card does not wait for them. */}
          <CardSection
            title={t('sellers.card.registers.title')}
            aside={
              <Suspense fallback={null}>
                <RegisterCheckBadge sellerId={seller.id} />
              </Suspense>
            }
          >
            <Suspense
              fallback={
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-600 [&_svg]:size-4">
                  <LoaderCircle className="animate-spin" />
                  {t('sellers.card.registers.loading')}
                </p>
              }
            >
              <RegisterCheckDetails
                sellerId={seller.id}
                czech={seller.company.countryCode === homeCountry}
              />
            </Suspense>
          </CardSection>
          <SellerContacts email={seller.contactEmail} phone={seller.contactPhone} />
          <SellerStore store={seller.store} />
          <SellerPayouts payoutAccount={seller.payoutAccount} />
          <SellerDocuments
            sellerId={seller.id}
            documents={seller.documents}
            requiredDocuments={seller.requiredDocuments}
          />
          <SellerTraceabilityList
            traceability={seller.traceability}
            termsAcceptedAt={seller.termsAcceptedAt}
            selfCertifiedAt={seller.selfCertifiedAt}
          />
          <SellerMessages seller={seller} canWrite={writesToSellers(user.platformAccess)} />
          {/* The API takes a decision only from a person with full access to sellers. */}
          {user.platformAccess.sellers === 'full' ? <Decision seller={seller} /> : null}
          {/* The history comes last: it only grows, and the decision has to stay within reach. */}
          <SellerHistory history={seller.history} />
        </>
      ) : (
        <CardNote failed>{t('sellers.card.error')}</CardNote>
      )}
    </div>
  );
}

/** The decision block with its texts and the server actions it calls. */
async function Decision({ seller }: { readonly seller: ModeratedSeller }) {
  const t = await getTranslations('sellers.card.errors');
  const { decision, errors } = (await getMessages()).sellers.card;

  return (
    <SellerDecision
      // A new block for every status, so nothing of a decision that is made stays in it.
      key={seller.status}
      sellerId={seller.id}
      status={seller.status}
      labels={decision}
      errors={{
        ...errors,
        VALIDATION_FAILED: t('VALIDATION_FAILED', {
          min: decisionMessageMinLength,
          max: decisionMessageMaxLength,
        }),
      }}
      afterRemovalHref={sellerTabPath('DRAFT')}
      approve={approveSeller}
      requestDocuments={requestSellerDocuments}
      reject={rejectSeller}
      reopen={reopenSeller}
      removeDraft={removeSellerDraft}
    />
  );
}

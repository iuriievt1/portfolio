import type { ModeratedSeller } from '@bluberi/api-client';
import { PageTitle } from '@bluberi/ui/components/app-shell';
import { Avatar } from '@bluberi/ui/components/avatar';
import { Badge } from '@bluberi/ui/components/badge';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';

import { dayAndTime, timeAgo } from '../../sellers/formats';
import { sellerStatusTones } from '../../sellers/tones';
import { Fact, Facts } from '../facts';

/** The head of the card: who the seller is, where the check stands and what the team said last. */
export async function SellerSummary({ seller }: { readonly seller: ModeratedSeller }) {
  const t = await getTranslations('sellers');
  const format = await getFormatter();
  const now = await getNow();
  // A draft was never sent, so it says when it was started.
  const sent = new Date(seller.submittedAt ?? seller.createdAt);
  const reviewed = seller.reviewedAt
    ? format.dateTime(new Date(seller.reviewedAt), dayAndTime)
    : undefined;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar name={seller.company.legalName} imageUrl={seller.store?.logoUrl} size="md" />
        <div className="min-w-0 flex-1 basis-56 break-words">
          <PageTitle>{seller.company.legalName}</PageTitle>
        </div>
        <Badge tone={sellerStatusTones[seller.status]}>{t(`statuses.${seller.status}`)}</Badge>
      </div>
      <Facts className="mt-4">
        <Fact label={t(seller.submittedAt ? 'card.summary.submitted' : 'card.summary.created')}>
          {t('card.summary.moment', {
            date: format.dateTime(sent, dayAndTime),
            ago: timeAgo(format, sent, now),
          })}
        </Fact>
        {reviewed ? (
          <Fact label={t('card.summary.reviewed')}>
            {seller.reviewedByEmail
              ? t('card.summary.reviewedBy', { email: seller.reviewedByEmail, date: reviewed })
              : reviewed}
          </Fact>
        ) : null}
        {seller.reviewMessage ? (
          <Fact label={t('card.summary.message')}>
            <span className="font-medium whitespace-pre-line">{seller.reviewMessage}</span>
          </Fact>
        ) : null}
      </Facts>
    </section>
  );
}

import type { CompanyCheck, ModeratedSellersPage } from '@bluberi/api-client';
import { Avatar } from '@bluberi/ui/components/avatar';
import { Badge, type BadgeTone } from '@bluberi/ui/components/badge';
import { FileText, MessageSquare } from 'lucide-react';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { sectionLine } from '../../sellers/categories';
import { dayAndTime, timeAgo } from '../../sellers/formats';
import { sellerPath, sellersPath, sellerTabQuery, type SellerTab } from '../../sellers/paths';
import { payoutStatusTones } from '../../sellers/tones';
import { ListNote } from '../list-card';
import { ListPaging } from '../list-paging';
import { SoldSections } from './sold-sections';

/** A register confirmed the company at the registration, or the team has to by the documents. */
const companyCheckTones = {
  COMPANY_REGISTER: 'green',
  VAT_REGISTER: 'green',
  DOCUMENTS: 'amber',
} as const satisfies Record<CompanyCheck, BadgeTone>;

/**
 * In a wide place the list is a table: the heading and every row lie on the columns of the list.
 * In a narrow one every seller is a card.
 */
const onColumns = '@4xl:col-span-full @4xl:grid @4xl:grid-cols-subgrid';

interface CheckBadgeProps {
  readonly tone: BadgeTone;
  /** What the badge means, in words: the hint, and what a screen reader says. */
  readonly hint: string;
  readonly children: ReactNode;
}

/** One check of a seller as a small badge. The colour says how it went. */
function CheckBadge({ tone, hint, children }: CheckBadgeProps) {
  return (
    <span title={hint} className="inline-flex">
      <Badge tone={tone}>
        <span aria-hidden className="contents">
          {children}
        </span>
        <span className="sr-only">{hint}</span>
      </Badge>
    </span>
  );
}

interface SellerListProps {
  /** The tab the sellers belong to. */
  readonly tab: SellerTab;
  /** Undefined when the API did not answer with a list. */
  readonly page: ModeratedSellersPage | undefined;
  /** The cursor of the page that is shown. Nothing on the first page. */
  readonly cursor: string | undefined;
}

/** The sellers of one tab. A whole row opens the card of its seller. */
export async function SellerList({ tab, page, cursor }: SellerListProps) {
  const t = await getTranslations();
  const format = await getFormatter();
  const now = await getNow();

  return (
    <section className="@container overflow-hidden rounded-lg border border-gray-200 bg-white">
      {!page ? (
        <ListNote text={t('lists.error')} failed />
      ) : page.items.length === 0 ? (
        <ListNote text={t(`sellers.list.empty.${tab}`)} failed={false} />
      ) : (
        <ul className="@4xl:grid @4xl:grid-cols-[minmax(0,2fr)_auto_minmax(0,1.4fr)_auto_auto] @4xl:gap-x-5">
          <li
            aria-hidden
            className={`hidden border-b border-gray-200 bg-gray-50 px-5 py-3 text-[11.5px] font-extrabold tracking-[0.07em] whitespace-nowrap text-gray-600 uppercase ${onColumns}`}
          >
            <span>{t('sellers.list.columns.seller')}</span>
            <span>{t('sellers.list.columns.registrationNumber')}</span>
            <span>{t('sellers.list.columns.categories')}</span>
            {/* A draft was never sent, so its row says when it was started. */}
            <span>{t(`sellers.list.columns.${tab === 'DRAFT' ? 'created' : 'submitted'}`)}</span>
            <span>{t('sellers.list.columns.checks')}</span>
          </li>
          {page.items.map((seller) => {
            const sent = new Date(seller.submittedAt ?? seller.createdAt);
            const wholeSection = t('sellers.card.store.wholeSection');

            return (
              <li
                key={seller.id}
                className={`border-b border-gray-200 last:border-b-0 ${onColumns}`}
              >
                <Link
                  href={sellerPath(seller.id)}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-5 py-4 text-sm font-semibold transition-colors outline-none hover:bg-berry-50 focus-visible:bg-berry-50 focus-visible:ring-4 focus-visible:ring-berry-500/14 focus-visible:ring-inset @4xl:items-center @4xl:gap-x-5 @4xl:py-3.25 ${onColumns}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={seller.legalName} imageUrl={seller.logoUrl} />
                    {/* A card has room for a long name. A row of the table cuts it, and the hint says it whole. */}
                    <span className="flex min-w-0 flex-col break-words">
                      <span title={seller.legalName} className="font-bold @4xl:truncate">
                        {seller.legalName}
                      </span>
                      {seller.storeName ? (
                        <span className="text-[13px] text-gray-600 @4xl:truncate">
                          {seller.storeName}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="col-span-2 whitespace-nowrap tabular-nums @4xl:col-span-1">
                    <span className="text-gray-600">{seller.countryCode}</span>{' '}
                    {seller.registrationNumber}
                  </span>
                  {/* An empty cell keeps its column in the table and takes no line of a card. */}
                  <span
                    title={
                      seller.categories
                        .map((category) => sectionLine(category, wholeSection))
                        .join(', ') || undefined
                    }
                    className="col-span-2 truncate text-gray-600 empty:hidden @4xl:col-span-1 @4xl:empty:block"
                  >
                    <SoldSections sections={seller.categories} wholeSection={wholeSection} inline />
                  </span>
                  {/* In a card the time stands in the corner, next to the name. */}
                  <time
                    dateTime={sent.toISOString()}
                    title={format.dateTime(sent, dayAndTime)}
                    className="col-start-2 row-start-1 whitespace-nowrap text-gray-600 @4xl:col-start-auto @4xl:row-start-auto"
                  >
                    {timeAgo(format, sent, now)}
                  </time>
                  <span className="col-span-2 flex flex-wrap gap-1 @4xl:col-span-1 @4xl:flex-nowrap">
                    <CheckBadge
                      tone={companyCheckTones[seller.companyCheck]}
                      hint={t(`sellers.list.checks.companyHints.${seller.companyCheck}`)}
                    >
                      {t(`sellers.list.checks.company.${seller.companyCheck}`)}
                    </CheckBadge>
                    <CheckBadge
                      tone={payoutStatusTones[seller.payoutStatus ?? 'INCOMPLETE']}
                      hint={t(`sellers.list.checks.payoutHints.${seller.payoutStatus ?? 'NONE'}`)}
                    >
                      {t('sellers.list.checks.payouts')}
                    </CheckBadge>
                    <CheckBadge
                      tone="gray"
                      hint={t('sellers.list.checks.documents', { count: seller.documentsCount })}
                    >
                      <FileText />
                      {format.number(seller.documentsCount)}
                    </CheckBadge>
                    {seller.unreadConversations > 0 ? (
                      <CheckBadge
                        tone="sale"
                        hint={t('sellers.list.checks.unread', {
                          count: seller.unreadConversations,
                        })}
                      >
                        <MessageSquare />
                        {format.number(seller.unreadConversations)}
                      </CheckBadge>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <ListPaging
        path={sellersPath}
        query={sellerTabQuery(tab)}
        cursor={cursor}
        nextCursor={page?.nextCursor}
        first={t('lists.first')}
        next={t('lists.next')}
      />
    </section>
  );
}

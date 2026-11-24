import type { AuditAction, SellerHistoryEntry } from '@bluberi/api-client';
import { getFormatter, getTranslations } from 'next-intl/server';

import { dayAndTime } from '../../sellers/formats';
import { CardNote, CardSection } from '../card-section';

/** The actions of the audit log that are done to a seller. Each has its words in the texts. */
type SellerAction = Extract<AuditAction, `seller.${string}`>;

function isSellerAction(action: AuditAction): action is SellerAction {
  return action.startsWith('seller.');
}

/** What happened to the seller, newest first: what was done, who did it and when. */
export async function SellerHistory({
  history,
}: {
  readonly history: readonly SellerHistoryEntry[];
}) {
  const t = await getTranslations('sellers.card.history');
  const format = await getFormatter();

  return (
    <CardSection title={t('title')}>
      {history.length === 0 ? (
        <CardNote>{t('empty')}</CardNote>
      ) : (
        <ol className="flex flex-col text-sm">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="border-b border-gray-200 py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="font-bold">
                  {/* An action of another kind has no words here, so its code is shown. */}
                  {isSellerAction(entry.action) ? t(`actions.${entry.action}`) : entry.action}
                </span>
                <time
                  dateTime={entry.createdAt}
                  className="text-[13px] font-semibold whitespace-nowrap text-gray-600 tabular-nums"
                >
                  {format.dateTime(new Date(entry.createdAt), dayAndTime)}
                </time>
              </div>
              <p className="text-[13px] font-semibold break-words text-gray-600">
                {entry.actorEmail ?? t('system')}
              </p>
              {entry.message ? (
                <p className="mt-2 rounded-sm bg-gray-50 px-3 py-2 text-[13px] font-medium break-words whitespace-pre-line">
                  {entry.message}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </CardSection>
  );
}

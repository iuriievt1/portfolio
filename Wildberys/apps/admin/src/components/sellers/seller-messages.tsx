import type { ModeratedSeller } from '@bluberi/api-client';
import { NewConversationForm } from '@bluberi/ui/components/inbox';
import { ChevronRight } from 'lucide-react';
import { getFormatter, getMessages, getNow, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { openSellerConversation } from '../../support/actions';
import {
  conversationPath,
  getTeamInbox,
  inboxPath,
  messageMaxLength,
  subjectMaxLength,
} from '../../support/inbox';
import { previewOf, subjectOf, timeOf } from '../../support/texts';
import { CardNote, CardSection } from '../card-section';
import { textLinkClasses } from '../text-link';

/** The statuses in which the seller has the portal, so the two sides can write to each other. */
const openStatuses: readonly ModeratedSeller['status'][] = [
  'PENDING_REVIEW',
  'DOCUMENTS_REQUESTED',
  'APPROVED',
];

interface SellerMessagesProps {
  readonly seller: ModeratedSeller;
  /** The person may write to sellers. */
  readonly canWrite: boolean;
}

/**
 * The conversations of the team with a seller: each opens in the inbox, and a new one is written here.
 * The decisions of the team stand in the conversation about the registration.
 */
export async function SellerMessages({ seller, canWrite }: SellerMessagesProps) {
  const t = await getTranslations('sellers.card.messages');
  const support = await getTranslations('support');
  const { errors } = (await getMessages()).support;
  const format = await getFormatter();
  const now = await getNow();
  const inbox = await getTeamInbox(seller.id);
  const open = openStatuses.includes(seller.status);

  return (
    <CardSection title={t('title')}>
      {inbox ? (
        <div className="flex flex-col gap-5">
          {inbox.items.length > 0 ? (
            <ul className="flex flex-col overflow-hidden rounded-md border border-gray-200">
              {inbox.items.map((conversation) => (
                <li key={conversation.id} className="border-b border-gray-200 last:border-b-0">
                  <Link
                    href={conversationPath(conversation.id)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-berry-50 focus-visible:bg-berry-50"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`truncate text-[15px] ${conversation.unreadCount > 0 ? 'font-extrabold' : 'font-bold'}`}
                      >
                        {subjectOf(conversation, support('registration'))}
                      </span>
                      <span className="truncate text-[13px] font-medium text-gray-600">
                        {previewOf(conversation.lastMessage, {
                          team: support('team'),
                          decisions: {
                            DOCUMENTS_REQUESTED: support('decisions.DOCUMENTS_REQUESTED'),
                            APPROVED: support('decisions.APPROVED'),
                            REJECTED: support('decisions.REJECTED'),
                          },
                        })}
                      </span>
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-pink-500 px-1.5 text-[11px] font-extrabold text-white tabular-nums">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                    <span className="flex-none text-xs font-semibold text-gray-600">
                      {timeOf(format, new Date(conversation.lastMessageAt), now)}
                    </span>
                    <ChevronRight className="size-4 flex-none text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardNote>{t('empty')}</CardNote>
          )}
          {/* The card shows the newest conversations. The inbox has all of them. */}
          {inbox.nextCursor ? (
            <Link href={inboxPath} className={`w-fit text-[13px] ${textLinkClasses}`}>
              {t('more')}
            </Link>
          ) : null}
          {canWrite && open ? (
            <details className="group">
              <summary className="w-fit cursor-pointer rounded-sm bg-berry-100 px-3.5 py-2 text-[13px] font-bold text-berry-600 transition-colors outline-none hover:bg-berry-200 focus-visible:ring-4 focus-visible:ring-berry-500/14">
                {t('write')}
              </summary>
              <div className="mt-4">
                <NewConversationForm
                  subjectLabel={t('subjectLabel')}
                  bodyLabel={t('bodyLabel')}
                  hint={t('hint')}
                  sendLabel={t('send')}
                  subjectMaxLength={subjectMaxLength}
                  bodyMaxLength={messageMaxLength}
                  errors={errors}
                  send={openSellerConversation.bind(null, seller.id)}
                />
              </div>
            </details>
          ) : null}
          {canWrite && !open ? <CardNote>{support('closed')}</CardNote> : null}
        </div>
      ) : (
        <CardNote failed>{t('error')}</CardNote>
      )}
    </CardSection>
  );
}

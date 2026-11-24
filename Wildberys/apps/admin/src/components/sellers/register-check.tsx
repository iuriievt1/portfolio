import type { RegisterCheckResult, RegisterTrade } from '@bluberi/api-client';
import { Badge, type BadgeTone } from '@bluberi/ui/components/badge';
import { getFormatter, getTranslations } from 'next-intl/server';

import { dayOnly } from '../../sellers/formats';
import { getRegisterCheck } from '../../sellers/moderation';
import { CardNote } from '../card-section';
import { Fact, Facts } from '../facts';
import { textLinkClasses } from '../text-link';

const resultTones = {
  MATCHES: 'green',
  DIFFERS: 'amber',
  NOT_FOUND: 'red',
  UNAVAILABLE: 'gray',
  NOT_CHECKED: 'gray',
} as const satisfies Record<RegisterCheckResult, BadgeTone>;

/** The answer of the registers in a word, for the line of the title. Nothing when they could not be asked. */
export async function RegisterCheckBadge({ sellerId }: { readonly sellerId: string }) {
  const check = await getRegisterCheck(sellerId);
  const t = await getTranslations('sellers.card.registers');

  return check ? (
    <Badge tone={resultTones[check.result]}>{t(`results.${check.result}`)}</Badge>
  ) : null;
}

interface RegisterCheckDetailsProps {
  readonly sellerId: string;
  /** The company is Czech: the company register knows it, and the trade register its licences. */
  readonly czech: boolean;
}

/** What the public registers say about the company now, next to what the seller registered. */
export async function RegisterCheckDetails({ sellerId, czech }: RegisterCheckDetailsProps) {
  const check = await getRegisterCheck(sellerId);
  const t = await getTranslations('sellers.card.registers');

  if (!check) {
    return <CardNote failed>{t('error')}</CardNote>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CardNote>{t(`notes.${check.result}`)}</CardNote>
      {check.result === 'NOT_CHECKED' ? null : (
        <Facts>
          <Fact label={t('register')}>{t(`registerNames.${czech ? 'company' : 'vat'}`)}</Fact>
          {check.registerName ? <Fact label={t('registerName')}>{check.registerName}</Fact> : null}
          {check.registerAddress ? (
            <Fact label={t('registerAddress')}>{check.registerAddress}</Fact>
          ) : null}
          {check.differences.length > 0 ? (
            <Fact label={t('differences')}>
              <ul className="flex flex-col gap-0.5">
                {check.differences.map((difference) => (
                  <li key={difference}>{t(`differenceNames.${difference}`)}</li>
                ))}
              </ul>
            </Fact>
          ) : null}
        </Facts>
      )}
      {czech ? <Trades trades={check.trades} retail={check.retailTrade} /> : null}
    </div>
  );
}

/** The trade licences of a Czech company. Null when the trade register gave no record of it. */
/** How many trade licences are shown before the rest goes behind a click. */
const tradesInSight = 4;

interface TradesProps {
  readonly trades: readonly RegisterTrade[] | null;
  /** The licences let the company sell goods to buyers. Null when the licences are not known. */
  readonly retail: boolean | null;
}

async function Trades({ trades, retail }: TradesProps) {
  const t = await getTranslations('sellers.card.registers');
  const format = await getFormatter();
  // The free trade comes first: it is the one that covers selling goods.
  const sorted = (trades ?? []).toSorted(
    (first, second) => Number(second.kind === 'FREE') - Number(first.kind === 'FREE'),
  );
  const row = (trade: RegisterTrade) => (
    <li key={`${trade.name} ${trade.since}`}>
      <p className="font-bold break-words">{trade.name}</p>
      <p className="text-[13px] font-semibold text-gray-600">
        {t('tradeDetails', {
          kind: t(`tradeKinds.${trade.kind}`),
          date: format.dateTime(new Date(trade.since), dayOnly),
        })}
      </p>
      {trade.fields.length > 0 ? (
        // A free trade can have dozens of fields, so they open on a click.
        <details className="mt-1 text-[13px]">
          <summary className={`w-fit cursor-pointer ${textLinkClasses}`}>
            {t('tradeFields', { count: trade.fields.length })}
          </summary>
          <ul className="mt-1.5 list-disc pl-5 font-medium text-gray-700">
            {trade.fields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
      <h3 className="text-[11px] font-extrabold tracking-[0.1em] text-gray-600 uppercase">
        {t('trades')}
      </h3>
      {retail === null ? null : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-bold">
          {t('retail')}
          <Badge tone={retail ? 'green' : 'amber'}>{t(retail ? 'retailYes' : 'retailNo')}</Badge>
        </p>
      )}
      {trades === null ? (
        <CardNote>{t('tradesMissing')}</CardNote>
      ) : trades.length === 0 ? (
        <CardNote>{t('noTrades')}</CardNote>
      ) : (
        <>
          <ul className="flex flex-col gap-3 text-sm">{sorted.slice(0, tradesInSight).map(row)}</ul>
          {trades.length > tradesInSight ? (
            // A large company holds dozens of licences. The first ones say enough at a glance.
            <details className="text-sm">
              <summary className={`w-fit cursor-pointer text-[13px] ${textLinkClasses}`}>
                {t('moreTrades', { count: trades.length - tradesInSight })}
              </summary>
              <ul className="mt-3 flex flex-col gap-3">{sorted.slice(tradesInSight).map(row)}</ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

import type { PayoutAccount } from '@bluberi/api-client';
import { Badge } from '@bluberi/ui/components/badge';
import { FlaskConical } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { payoutStatusTones } from '../../sellers/tones';
import { CardNote, CardSection } from '../card-section';
import { Fact, Facts } from '../facts';

interface SellerPayoutsProps {
  /** Null until the seller chooses how to be paid. */
  readonly payoutAccount: PayoutAccount | null;
}

/**
 * How the seller is paid and where the check of the payment provider stands. Of a bank account
 * the API keeps the country, the last characters and the currency, never the whole number.
 */
export async function SellerPayouts({ payoutAccount }: SellerPayoutsProps) {
  const t = await getTranslations('sellers');

  if (!payoutAccount) {
    return (
      <CardSection title={t('card.payouts.title')}>
        <CardNote>{t('card.payouts.missing')}</CardNote>
      </CardSection>
    );
  }

  const { method, status, bankAccount } = payoutAccount;

  return (
    <CardSection
      title={t('card.payouts.title')}
      aside={<Badge tone={payoutStatusTones[status]}>{t(`payoutStatuses.${status}`)}</Badge>}
    >
      <Facts>
        <Fact label={t('card.payouts.method')}>{t(`card.payouts.methods.${method}`)}</Fact>
        {method === 'BANK' ? (
          <Fact label={t('card.payouts.bankAccount')}>
            {bankAccount
              ? t('card.payouts.bankAccountValue', {
                  country: bankAccount.country,
                  last4: bankAccount.last4,
                  currency: bankAccount.currency,
                })
              : t('card.payouts.noBankAccount')}
          </Fact>
        ) : null}
        {bankAccount ? (
          <Fact label={t('card.payouts.holder')}>{bankAccount.holderName}</Fact>
        ) : null}
      </Facts>
      {/* Until a Stripe account is connected, the status above comes from a simulation. */}
      <p className="mt-4 flex items-start gap-2 text-[12.5px] font-semibold text-gray-600 [&_svg]:mt-px [&_svg]:size-4 [&_svg]:flex-none">
        <FlaskConical />
        {t('card.payouts.simulation')}
      </p>
    </CardSection>
  );
}

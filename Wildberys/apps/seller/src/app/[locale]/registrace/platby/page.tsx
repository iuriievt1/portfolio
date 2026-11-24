import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { PayoutsStep } from '../../../../components/registration/payouts-step';
import { RegistrationShell } from '../../../../components/registration/registration-shell';
import { localizedPath } from '../../../../i18n/paths';
import {
  choosePayoutMethod,
  finishPayoutForm,
  saveBankAccount,
} from '../../../../registration/actions';
import { homeCountry } from '../../../../registration/countries';
import { getRegistration } from '../../../../registration/registration';
import { pagePaths } from '../../../../registration/steps';

/** Step 3 of the seller registration: how the seller gets paid, through Stripe or to a bank account. */
export default async function PayoutsPage({ params }: PageProps<'/[locale]/registrace/platby'>) {
  const { locale } = await params;

  return (
    <RegistrationShell step="payouts">
      {/* The payout account depends on the request, so the step streams in. */}
      <Suspense fallback={null}>
        <Payouts locale={locale} />
      </Suspense>
    </RegistrationShell>
  );
}

async function Payouts({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const messages = await getMessages();

  // The proxy lets in only people who registered a company. Nothing is drawn while the API does not answer.
  if (!registration?.seller) {
    return null;
  }

  return (
    <PayoutsStep
      payoutAccount={registration.seller.payoutAccount}
      legalName={registration.seller.company.legalName}
      czechSeller={registration.seller.company.countryCode === homeCountry}
      labels={{
        ...messages.registration.payouts,
        back: messages.registration.back,
        continue: messages.registration.continue,
      }}
      errors={messages.errors}
      backHref={localizedPath(pagePaths.documents, locale)}
      nextHref={localizedPath(pagePaths.store, locale)}
      chooseMethod={choosePayoutMethod}
      saveBankAccount={saveBankAccount}
      finishForm={finishPayoutForm}
    />
  );
}

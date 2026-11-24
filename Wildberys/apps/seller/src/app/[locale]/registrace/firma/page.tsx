import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { CompanyStep } from '../../../../components/registration/company-step';
import { RegistrationShell } from '../../../../components/registration/registration-shell';
import { Terms } from '../../../../components/registration/terms';
import { localizedPath } from '../../../../i18n/paths';
import {
  checkVatNumber,
  lookUpCompany,
  registerCompany,
  registerEuCompany,
} from '../../../../registration/actions';
import { countryChoices } from '../../../../registration/countries';
import { getRegistration } from '../../../../registration/registration';
import { pagePaths } from '../../../../registration/steps';

/** Step 2 of the seller registration: the company, checked in the register of its country or of the EU. */
export default async function CompanyPage({ params }: PageProps<'/[locale]/registrace/firma'>) {
  const { locale } = await params;

  return (
    <RegistrationShell step="company">
      {/* The company of the draft depends on the request, so the step streams in. */}
      <Suspense fallback={null}>
        <Company locale={locale} />
      </Suspense>
    </RegistrationShell>
  );
}

async function Company({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const messages = await getMessages();

  // The proxy lets only signed-in people in. Nothing is drawn while the API does not answer.
  if (!registration) {
    return null;
  }

  return (
    <CompanyStep
      company={registration.seller?.company ?? null}
      countries={countryChoices(registration.countries, locale)}
      labels={{
        ...messages.registration.company,
        ...messages.registration.address,
        back: messages.registration.back,
        continue: messages.registration.continue,
      }}
      terms={<Terms locale={locale} />}
      errors={messages.errors}
      backHref={localizedPath(pagePaths.account, locale)}
      nextHref={localizedPath(pagePaths.documents, locale)}
      lookUp={lookUpCompany}
      register={registerCompany}
      checkVatNumber={checkVatNumber}
      registerEuCompany={registerEuCompany}
    />
  );
}

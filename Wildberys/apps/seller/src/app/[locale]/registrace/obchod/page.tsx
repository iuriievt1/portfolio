import { categoriesTree } from '@bluberi/api-client';
import { createApiClient } from '@bluberi/web-auth/api-client';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { authConfig, welcomePath } from '../../../../auth/config';
import { RegistrationShell } from '../../../../components/registration/registration-shell';
import { StoreStep } from '../../../../components/registration/store-step';
import { localizedPath, toLocale } from '../../../../i18n/paths';
import { finishRegistration, uploadLogo } from '../../../../registration/actions';
import { addressLine } from '../../../../registration/address';
import { getRegistration } from '../../../../registration/registration';
import { pagePaths } from '../../../../registration/steps';

/** Step 4 of the seller registration: the store. Its button sends the registration. */
export default async function StorePage({ params }: PageProps<'/[locale]/registrace/obchod'>) {
  const { locale } = await params;

  return (
    <RegistrationShell step="store">
      {/* The store of the draft depends on the request, so the step streams in. */}
      <Suspense fallback={null}>
        <StoreOfSeller locale={locale} />
      </Suspense>
    </RegistrationShell>
  );
}

async function StoreOfSeller({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const messages = await getMessages();
  // The category tree is the same for everyone, so it is asked for without the person.
  const { data: sections } = await categoriesTree({
    client: createApiClient(authConfig()),
    query: { locale: toLocale(locale) },
  });

  // The proxy lets in only people who registered a company. Nothing is drawn while the API does not answer.
  if (!registration?.seller || !sections) {
    return null;
  }

  return (
    <StoreStep
      store={registration.seller.store}
      sections={sections}
      registeredAddress={addressLine(registration.seller.company.address)}
      countryCode={registration.seller.company.countryCode}
      labels={{
        ...messages.registration.store,
        ...messages.registration.address,
        back: messages.registration.back,
        close: messages.security.close,
      }}
      errors={messages.errors}
      backHref={localizedPath(pagePaths.payouts, locale)}
      doneHref={localizedPath(welcomePath, locale)}
      uploadLogo={uploadLogo}
      finish={finishRegistration}
    />
  );
}

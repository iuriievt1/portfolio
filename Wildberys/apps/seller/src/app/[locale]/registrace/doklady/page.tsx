import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { DocumentsStep } from '../../../../components/registration/documents-step';
import { RegistrationShell } from '../../../../components/registration/registration-shell';
import { localizedPath } from '../../../../i18n/paths';
import { addDocument, removeDocument } from '../../../../registration/actions';
import { getRegistration } from '../../../../registration/registration';
import { pagePaths } from '../../../../registration/steps';

/** The second page of the company step: the documents the team checks the seller by. */
export default async function DocumentsPage({ params }: PageProps<'/[locale]/registrace/doklady'>) {
  const { locale } = await params;

  return (
    <RegistrationShell step="company">
      {/* The documents of the draft depend on the request, so the page streams in. */}
      <Suspense fallback={null}>
        <Documents locale={locale} />
      </Suspense>
    </RegistrationShell>
  );
}

async function Documents({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const messages = await getMessages();

  // The proxy lets in only people who registered a company. Nothing is drawn while the API does not answer.
  if (!registration?.seller) {
    return null;
  }

  return (
    <DocumentsStep
      requiredKinds={registration.seller.requiredDocuments}
      documents={registration.seller.documents}
      locale={locale}
      labels={{
        ...messages.registration.documents,
        back: messages.registration.back,
        continue: messages.registration.continue,
      }}
      errors={messages.errors}
      backHref={localizedPath(pagePaths.company, locale)}
      nextHref={localizedPath(pagePaths.payouts, locale)}
      add={addDocument}
      remove={removeDocument}
    />
  );
}

'use client';

import type { CheckedVatNumber, Company, RegistrationCompany } from '@bluberi/api-client';
import { SelectField } from '@bluberi/ui/components/select-field';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { ArrowLeft, Globe } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { EuCompanyInput } from '../../registration/actions';
import { homeCountry, type CountryChoice } from '../../registration/countries';
import { useRegistrationDraft } from '../../registration/draft';
import { CzechCompanyForm, type CzechCompanyLabels } from './czech-company-form';
import { EuCompanyForm, type EuCompanyLabels } from './eu-company-form';
import { secondaryLink, StepFrame } from './step-frame';

export interface CompanyStepLabels extends CzechCompanyLabels, EuCompanyLabels {
  readonly title: string;
  /** The sentence under the title for a Czech company, and the one for a company from another country. */
  readonly text: string;
  readonly textAbroad: string;
  /** For a trader from another country who has no VAT number. */
  readonly textWithoutVatNumber: string;
  readonly countryLabel: string;
  readonly back: string;
}

interface CompanyStepProps {
  /** The company of the draft, when this step was done before. */
  readonly company: RegistrationCompany | null;
  /** The countries a company can be registered in, in the order they are offered. */
  readonly countries: readonly CountryChoice[];
  readonly labels: CompanyStepLabels;
  /** The sentence about the terms for sellers, with its link. Asked here when it was not ticked in this tab. */
  readonly terms: ReactNode;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly backHref: Route;
  readonly nextHref: Route;
  /** Server actions of a Czech company: read it from the register, register it. */
  readonly lookUp: (ico: string) => Promise<ActionResult<Company>>;
  readonly register: (
    ico: string,
    isVatPayer: boolean,
    termsAccepted: boolean,
  ) => Promise<ActionResult>;
  /** Server actions of a company from another country: check its VAT number, register it. */
  readonly checkVatNumber: (
    countryCode: string,
    number: string,
  ) => Promise<ActionResult<CheckedVatNumber>>;
  readonly registerEuCompany: (
    company: EuCompanyInput,
    termsAccepted: boolean,
  ) => Promise<ActionResult>;
}

/**
 * Step 2 of the registration: the company. The seller first says which country it is registered in.
 * A Czech company is read from the register ARES by its number. A company from another EU country
 * gives its VAT number, which is checked in the register VIES.
 */
export function CompanyStep({
  company,
  countries,
  labels,
  terms,
  errors,
  backHref,
  nextHref,
  lookUp,
  register,
  checkVatNumber,
  registerEuCompany,
}: CompanyStepProps) {
  const [draft, keep] = useRegistrationDraft();
  const wanted = draft.countryCode ?? company?.countryCode;
  // A country kept in the tab or saved earlier counts only while it is still offered.
  const countryCode =
    countries.some(({ code }) => code === wanted) && wanted ? wanted : homeCountry;
  const atHome = countryCode === homeCountry;
  const savedHere = company?.countryCode === countryCode ? company : null;
  // A company saved without a VAT number opens the same way it was registered.
  const withoutVatNumber =
    !atHome &&
    (draft.typedCompany?.noVatNumber ?? (savedHere !== null && savedHere.vatNumber === null));
  const abroadText = withoutVatNumber ? labels.textWithoutVatNumber : labels.textAbroad;

  return (
    <StepFrame
      title={labels.title}
      text={atHome ? labels.text : abroadText}
      secondary={
        <Link href={backHref} className={secondaryLink}>
          <ArrowLeft />
          {labels.back}
        </Link>
      }
    >
      <SelectField
        label={labels.countryLabel}
        icon={<Globe />}
        name="country"
        autoComplete="country"
        options={countries.map(({ code, name }) => ({ value: code, label: name }))}
        value={countryCode}
        onChange={(event) => {
          // What was typed about a company of one country says nothing about a company of another.
          keep({ countryCode: event.target.value, typedCompany: undefined, vatCheck: undefined });
        }}
      />
      {atHome ? (
        <CzechCompanyForm
          company={savedHere}
          labels={labels}
          terms={terms}
          errors={errors}
          nextHref={nextHref}
          lookUp={lookUp}
          register={register}
        />
      ) : (
        <EuCompanyForm
          // Another country starts an empty form.
          key={countryCode}
          countryCode={countryCode}
          company={savedHere}
          withoutVatNumber={withoutVatNumber}
          labels={labels}
          terms={terms}
          errors={errors}
          nextHref={nextHref}
          check={checkVatNumber}
          register={registerEuCompany}
        />
      )}
    </StepFrame>
  );
}

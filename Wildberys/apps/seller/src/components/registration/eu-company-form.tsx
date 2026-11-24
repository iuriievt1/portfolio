'use client';

import type { CheckedVatNumber, RegistrationCompany, SellerLegalForm } from '@bluberi/api-client';
import { TextButton } from '@bluberi/ui/components/button';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { TextField } from '@bluberi/ui/components/text-field';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { ArrowRight, Building2, FileText, Hash, Search } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import type { EuCompanyInput } from '../../registration/actions';
import { typeCompany, useRegistrationDraft } from '../../registration/draft';
import { vatLetters, vatNumberOf, withoutVatLetters } from '../../registration/vat-number';
import { AddressFields, type AddressLabels } from './address-fields';
import { PublicNote, RegisterCard, TermsTick } from './company-parts';
import { OptionBoxes } from './option-boxes';
import { errorText, SubmitButton, textOf } from './step-frame';

/** A VAT number the way people write it: with or without the letters of the country, in groups or in one piece. */
const vatNumberAsTyped = String.raw`[A-Za-z0-9+*]([ .\-]?[A-Za-z0-9+*]){1,13}`;
/** A number of a business register: letters and digits with the spaces, dots, slashes and dashes registers write. */
const registrationNumberAsTyped = String.raw`[A-Za-z0-9]([A-Za-z0-9 .\/\-]{0,38}[A-Za-z0-9])`;

const legalForms = ['COMPANY', 'SOLE_TRADER'] as const satisfies readonly SellerLegalForm[];

export interface EuCompanyLabels extends AddressLabels {
  readonly vatIdLabel: string;
  readonly check: string;
  readonly vatSource: string;
  readonly vatValid: string;
  readonly legalNameLabel: string;
  readonly legalFormLabel: string;
  readonly legalForms: Readonly<Record<SellerLegalForm, string>>;
  readonly registrationNumberLabel: string;
  readonly registrationNumberHint: string;
  readonly invalidVatNumber: string;
  readonly noVatNumber: string;
  readonly haveVatNumber: string;
  readonly withoutCheck: string;
  readonly manualNote: string;
  readonly publicNote: string;
  readonly continue: string;
}

interface EuCompanyFormProps {
  /** The country the seller chose. */
  readonly countryCode: string;
  /** The company of the draft, when it is from this country and this step was done before. */
  readonly company: RegistrationCompany | null;
  /** The trader says they have no VAT number, so no register is asked. */
  readonly withoutVatNumber: boolean;
  readonly labels: EuCompanyLabels;
  /** The sentence about the terms for sellers, with its link. */
  readonly terms: ReactNode;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly nextHref: Route;
  /** Server action: asks the register of VAT numbers of the EU about a number. */
  readonly check: (countryCode: string, number: string) => Promise<ActionResult<CheckedVatNumber>>;
  /** Server action: registers the company for the seller. */
  readonly register: (company: EuCompanyInput, termsAccepted: boolean) => Promise<ActionResult>;
}

/** How the register of VAT numbers says it cannot answer now. */
const registerSilent = 'VAT_REGISTRY_UNAVAILABLE';

/**
 * A company from another EU country: the seller types its VAT number, and the register VIES says
 * whether it is valid and, for most countries, whose it is. VIES knows little more, so the seller
 * then writes the registration number and the address. The same button first checks, then goes on.
 * A trader without a VAT number, and a company whose register does not answer, go on without
 * the check: the team then checks the documents of the next page.
 */
export function EuCompanyForm({
  countryCode,
  company,
  withoutVatNumber,
  labels,
  terms,
  errors,
  nextHref,
  check,
  register,
}: EuCompanyFormProps) {
  const router = useRouter();
  const [draft, keep] = useRegistrationDraft();
  const [errorCode, setErrorCode] = useState<string>();
  // The number the person goes on with although the register did not answer about it.
  const [uncheckedNumber, setUncheckedNumber] = useState<string>();
  const [busy, startTransition] = useTransition();

  const typed = draft.typedCompany ?? {};
  const letters = vatLetters(countryCode);
  const vatNumber = typed.vatNumber ?? company?.vatNumber?.slice(letters.length) ?? '';
  const number = vatNumberOf(countryCode, vatNumber);
  // The answer of the register counts while the number it was asked about stays in the field.
  const checked =
    !withoutVatNumber &&
    draft.vatCheck?.countryCode === countryCode &&
    draft.vatCheck.number === number
      ? draft.vatCheck
      : undefined;
  const withoutCheck = withoutVatNumber || (number !== '' && uncheckedNumber === number);
  // The rest of the company is asked for once the number is checked, or once the person goes on without it.
  const ready = checked !== undefined || withoutCheck;
  const legalForm = typed.legalForm ?? company?.legalForm ?? 'COMPANY';
  const error = errorText(errors, errorCode, ready ? undefined : labels.invalidVatNumber);

  function type(change: Parameters<typeof typeCompany>[0]): void {
    setErrorCode(undefined);
    typeCompany(change);
  }

  return (
    <Form
      className="flex flex-col gap-4"
      onFields={(formData) => {
        startTransition(async () => {
          if (!ready) {
            const result = await check(countryCode, number);

            if (result.ok) {
              keep({ vatCheck: { countryCode, number, ...result.value } });
            }

            setErrorCode(result.ok ? undefined : result.code);

            return;
          }

          const result = await register(
            {
              countryCode,
              vatNumber: withoutVatNumber ? null : number,
              registrationNumber: textOf(formData, 'registrationNumber'),
              legalName: checked?.name ?? textOf(formData, 'legalName'),
              legalForm,
              address: {
                street: textOf(formData, 'street'),
                city: textOf(formData, 'city'),
                postalCode: textOf(formData, 'postalCode'),
              },
            },
            draft.termsAccepted === true,
          );

          if (result.ok) {
            router.push(nextHref);
          } else {
            setErrorCode(result.code);
          }
        });
      }}
    >
      {withoutVatNumber ? (
        <span className="-mt-1.5 text-[13px] font-semibold">
          <TextButton
            onClick={() => {
              type({ noVatNumber: false });
            }}
          >
            {labels.haveVatNumber}
          </TextButton>
        </span>
      ) : (
        <div className="flex flex-col gap-2">
          <TextField
            label={labels.vatIdLabel}
            icon={<span className="text-[15px] font-extrabold text-gray-500">{letters}</span>}
            name="vatNumber"
            // The letters of a VAT number are capital, however they are typed.
            className="[&_input]:uppercase"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            pattern={vatNumberAsTyped}
            maxLength={20}
            value={vatNumber}
            onChange={(event) => {
              type({ vatNumber: withoutVatLetters(countryCode, event.target.value) });
            }}
          />
          {ready ? null : (
            <span className="text-[13px] font-semibold">
              <TextButton
                onClick={() => {
                  type({ noVatNumber: true });
                }}
              >
                {labels.noVatNumber}
              </TextButton>
            </span>
          )}
        </div>
      )}

      {ready ? (
        <>
          {checked ? (
            <RegisterCard
              title={checked.name ?? checked.vatNumber}
              source={labels.vatSource}
              lines={[
                checked.name ? `${labels.vatIdLabel} ${checked.vatNumber}` : labels.vatValid,
                ...(checked.address ? [checked.address] : []),
              ]}
            />
          ) : null}
          {/* A number nobody could check: the person is told how the company is checked instead. */}
          {withoutCheck && !withoutVatNumber ? (
            <p className="flex items-center gap-2 rounded-sm bg-gray-50 px-3.5 py-3 text-[13px] font-semibold text-gray-600 [&_svg]:size-4 [&_svg]:flex-none">
              <FileText />
              {labels.manualNote}
            </p>
          ) : null}
          <div className="flex animate-step-in flex-col gap-4">
            {/* Some countries keep the names behind their VAT numbers to themselves. */}
            {checked?.name ? null : (
              <TextField
                label={labels.legalNameLabel}
                icon={<Building2 />}
                name="legalName"
                autoComplete="organization"
                required
                minLength={2}
                maxLength={200}
                defaultValue={typed.legalName ?? company?.legalName}
                onChange={(event) => {
                  type({ legalName: event.target.value });
                }}
              />
            )}
            <OptionBoxes
              label={labels.legalFormLabel}
              name="legalForm"
              options={legalForms.map((value) => ({ value, label: labels.legalForms[value] }))}
              value={legalForm}
              onChange={(value) => {
                type({ legalForm: value });
              }}
            />
            <TextField
              label={labels.registrationNumberLabel}
              hint={labels.registrationNumberHint}
              icon={<Hash />}
              name="registrationNumber"
              autoComplete="off"
              spellCheck={false}
              required
              pattern={registrationNumberAsTyped}
              maxLength={40}
              defaultValue={typed.registrationNumber ?? company?.registrationNumber}
              onChange={(event) => {
                type({ registrationNumber: event.target.value });
              }}
            />
            <AddressFields
              countryCode={countryCode}
              labels={labels}
              address={{
                street: typed.street ?? company?.address.street,
                city: typed.city ?? company?.address.city,
                postalCode: typed.postalCode ?? company?.address.postalCode,
              }}
              onType={type}
            />
          </div>
          <PublicNote>{labels.publicNote}</PublicNote>
          <TermsTick terms={terms} />
        </>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
      {/* The register of the country is silent. The person can wait, or go on and be checked by documents. */}
      {errorCode === registerSilent && !ready ? (
        <span className="-mt-1.5 text-[13px] font-semibold">
          <TextButton
            onClick={() => {
              setUncheckedNumber(number);
              setErrorCode(undefined);
            }}
          >
            {labels.withoutCheck}
          </TextButton>
        </span>
      ) : null}

      <SubmitButton busy={busy} icon={ready ? <ArrowRight /> : <Search />}>
        {ready ? labels.continue : labels.check}
      </SubmitButton>
    </Form>
  );
}

'use client';

import type { Company, RegistrationCompany } from '@bluberi/api-client';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { TextField } from '@bluberi/ui/components/text-field';
import { Toggle } from '@bluberi/ui/components/toggle';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { ArrowRight, Building2, Download } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import { addressLine } from '../../registration/address';
import { useRegistrationDraft } from '../../registration/draft';
import { PublicNote, RegisterCard, TermsTick } from './company-parts';
import { errorText, SubmitButton } from './step-frame';

/** Eight digits the way people write them: in one piece or in groups. */
const companyIdAsTyped = String.raw`[0-9]( ?[0-9]){7}`;

export interface CzechCompanyLabels {
  /** The name of the number in the card of the company, and the label of its field, which says whose number it is. */
  readonly icoLabel: string;
  readonly icoFieldLabel: string;
  readonly load: string;
  readonly source: string;
  readonly legalForms: Readonly<Record<Company['legalForm'], string>>;
  readonly vatNumberLabel: string;
  readonly vatPayer: string;
  readonly invalidIco: string;
  readonly publicNote: string;
  readonly continue: string;
}

interface CzechCompanyFormProps {
  /** The Czech company of the draft, when this step was done before. */
  readonly company: RegistrationCompany | null;
  readonly labels: CzechCompanyLabels;
  /** The sentence about the terms for sellers, with its link. */
  readonly terms: ReactNode;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly nextHref: Route;
  /** Server action: reads the company from the public register. */
  readonly lookUp: (ico: string) => Promise<ActionResult<Company>>;
  /** Server action: registers the company for the seller. */
  readonly register: (
    ico: string,
    isVatPayer: boolean,
    termsAccepted: boolean,
  ) => Promise<ActionResult>;
}

function sameNumber(typed: string, ico: string): boolean {
  return typed.replace(/\s+/g, '') === ico;
}

/** The saved company in the shape the register answers with, so one card shows both. */
function asRegisterCompany({ registrationNumber, ...company }: RegistrationCompany): Company {
  return { ...company, ico: registrationNumber };
}

/**
 * A Czech company: the seller types the company number, the rest is read from the register ARES
 * and shown as one card. The same button first loads the company, then goes on.
 */
export function CzechCompanyForm({
  company,
  labels,
  terms,
  errors,
  nextHref,
  lookUp,
  register,
}: CzechCompanyFormProps) {
  const router = useRouter();
  const [draft, keep] = useRegistrationDraft();
  // What the register answered in this visit. Before any answer, the company saved earlier is shown.
  const [found, setFound] = useState<Company>();
  const [vatPayer, setVatPayer] = useState<boolean>();
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();

  const saved = company ? asRegisterCompany(company) : undefined;
  const ico = draft.ico ?? saved?.ico ?? '';
  const loaded = [found, saved].find((candidate) => candidate && sameNumber(ico, candidate.ico));
  const isVatPayer = (vatPayer ?? loaded?.isVatPayer ?? false) && loaded?.vatNumber != null;
  const error = errorText(errors, errorCode, labels.invalidIco);

  return (
    <Form
      className="flex flex-col gap-4"
      onFields={() => {
        startTransition(async () => {
          if (!loaded) {
            const result = await lookUp(ico);

            setFound(result.ok ? result.value : undefined);
            setVatPayer(undefined);
            setErrorCode(result.ok ? undefined : result.code);

            return;
          }

          const result = await register(loaded.ico, isVatPayer, draft.termsAccepted === true);

          if (result.ok) {
            keep({ ico: undefined });
            router.push(nextHref);
          } else {
            setErrorCode(result.code);
          }
        });
      }}
    >
      <TextField
        label={labels.icoFieldLabel}
        icon={<Building2 />}
        name="ico"
        autoComplete="off"
        inputMode="numeric"
        required
        pattern={companyIdAsTyped}
        maxLength={15}
        value={ico}
        onChange={(event) => {
          setErrorCode(undefined);
          keep({ ico: event.target.value });
        }}
      />

      {loaded ? (
        <>
          <RegisterCard
            title={loaded.legalName}
            source={labels.source}
            lines={[
              [
                labels.legalForms[loaded.legalForm],
                `${labels.icoLabel} ${loaded.ico}`,
                loaded.vatNumber ? `${labels.vatNumberLabel} ${loaded.vatNumber}` : undefined,
              ]
                .filter(Boolean)
                .join(' · '),
              addressLine(loaded.address),
            ]}
          >
            {/* A payer of VAT has a tax number in the register. Without one there is nothing to choose. */}
            {loaded.vatNumber === null ? null : (
              <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-gray-200 px-4 py-3">
                <span className="text-sm font-extrabold">{labels.vatPayer}</span>
                <Toggle
                  label={labels.vatPayer}
                  checked={isVatPayer}
                  onChange={(event) => {
                    setVatPayer(event.target.checked);
                  }}
                />
              </label>
            )}
          </RegisterCard>
          <PublicNote>{labels.publicNote}</PublicNote>
          <TermsTick terms={terms} />
        </>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}

      <SubmitButton busy={busy} icon={loaded ? <ArrowRight /> : <Download />}>
        {loaded ? labels.continue : labels.load}
      </SubmitButton>
    </Form>
  );
}

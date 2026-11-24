'use client';

import type { Currency, PayoutAccount, PayoutMethod } from '@bluberi/api-client';
import { Badge } from '@bluberi/ui/components/badge';
import { TextButton } from '@bluberi/ui/components/button';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { TextField } from '@bluberi/ui/components/text-field';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  CreditCard,
  FlaskConical,
  Landmark,
  User,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import {
  compactIban,
  czechAccountOf,
  czechIban,
  groupedIban,
} from '../../registration/bank-account';
import { OptionBoxes } from './option-boxes';
import { DoneRow, errorText, secondaryLink, StepFrame, SubmitButton, textOf } from './step-frame';

/** The order the two ways are offered in. A bank account is what every company has. */
const methods = ['BANK', 'STRIPE'] as const satisfies readonly PayoutMethod[];

const methodIcons: Record<PayoutMethod, ReactNode> = {
  BANK: <Landmark />,
  STRIPE: <CreditCard />,
};

/** The currencies Bluberi pays in. Crowns come first: the first market is Czechia. */
const currencies = ['CZK', 'EUR'] as const satisfies readonly Currency[];

/** A Czech account the way people write it: an optional prefix, a dash and the number. */
const accountNumberAsTyped = String.raw`([0-9]{1,6} ?- ?)?[0-9]{2,10}`;
const bankCodeAsTyped = String.raw`[0-9]{4}`;
/** An IBAN the way people write it: with or without spaces, in capital or small letters. */
const ibanAsTyped = String.raw`[A-Za-z]{2}[0-9]{2}( ?[A-Za-z0-9]){11,30}`;

/** Shown in place of an error of the API when the person goes on without a choice. */
const nothingChosen = 'NOTHING_CHOSEN';

export interface PayoutsStepLabels {
  readonly title: string;
  readonly text: string;
  readonly methods: Readonly<
    Record<PayoutMethod, { readonly title: string; readonly text: string }>
  >;
  readonly accountNumberLabel: string;
  readonly bankCodeLabel: string;
  readonly ibanLabel: string;
  readonly currencyLabel: string;
  readonly holderLabel: string;
  /** Has the places {country}, {last4} and {currency}. */
  readonly bankAccountSaved: string;
  readonly changeBankAccount: string;
  readonly invalidBankAccount: string;
  readonly chooseMethod: string;
  readonly statuses: Readonly<Record<'PENDING' | 'VERIFIED', string>>;
  readonly simulation: string;
  readonly back: string;
  readonly continue: string;
}

interface PayoutsStepProps {
  /** Null until the seller chooses how to be paid. */
  readonly payoutAccount: PayoutAccount | null;
  /** The name of the company: a company account is held under it. */
  readonly legalName: string;
  /** The company is Czech, so its account is most likely written the Czech way and held in crowns. */
  readonly czechSeller: boolean;
  readonly labels: PayoutsStepLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly backHref: Route;
  readonly nextHref: Route;
  readonly chooseMethod: (method: PayoutMethod) => Promise<ActionResult>;
  readonly saveBankAccount: (
    iban: string,
    holderName: string,
    currency: Currency,
  ) => Promise<ActionResult>;
  /** Server action: the seller finished the form of the payment provider. */
  readonly finishForm: () => Promise<ActionResult>;
}

/** The bank account as it is being typed. It is never kept anywhere but in this form. */
interface TypedAccount {
  readonly accountNumber: string;
  readonly bankCode: string;
  readonly iban: string;
  readonly currency: Currency;
}

/** Nothing typed yet. A company from another country most likely has an account in euros. */
function emptyAccount(czechSeller: boolean): TypedAccount {
  return { accountNumber: '', bankCode: '', iban: '', currency: czechSeller ? 'CZK' : 'EUR' };
}

/**
 * Step 3 of the registration: how the seller gets paid. A seller with a Stripe account goes through
 * the form of Stripe. A seller without one gives the bank account of the company here. A Czech company
 * gets the account number with the bank code, the IBAN and the currency: the number and the IBAN say
 * the same thing, so typing one fills the other. A company from another country gives the IBAN
 * and the currency. In both ways Stripe checks the seller and sends the money.
 * Until a Stripe account is connected, its check is simulated.
 */
export function PayoutsStep({
  payoutAccount,
  legalName,
  czechSeller,
  labels,
  errors,
  backHref,
  nextHref,
  chooseMethod,
  saveBankAccount,
  finishForm,
}: PayoutsStepProps) {
  const router = useRouter();
  const [changingBankAccount, setChangingBankAccount] = useState(false);
  const [typed, setTyped] = useState(() => emptyAccount(czechSeller));
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();
  const method = payoutAccount?.method;
  const status = payoutAccount?.status ?? 'INCOMPLETE';
  const bankAccount = payoutAccount?.bankAccount ?? null;
  const typingBankAccount = method === 'BANK' && (bankAccount === null || changingBankAccount);
  const error =
    errorCode === nothingChosen
      ? labels.chooseMethod
      : errorText(errors, errorCode, labels.invalidBankAccount);

  /** The Czech way of writing the account changed: the IBAN follows it. */
  function typeCzechAccount(accountNumber: string, bankCode: string): void {
    const iban = czechIban(accountNumber, bankCode);

    setTyped({
      accountNumber,
      bankCode,
      iban: iban ? groupedIban(iban) : typed.iban,
      currency: typed.currency,
    });
  }

  /** The IBAN changed: a Czech one fills the number and the bank code, another one empties them. */
  function typeIban(iban: string): void {
    const czech = czechAccountOf(iban);
    const abroad = !czech && !compactIban(iban).startsWith('CZ') && compactIban(iban).length >= 2;

    setTyped({
      accountNumber: czech?.accountNumber ?? '',
      bankCode: czech?.bankCode ?? '',
      iban,
      // An account in another country is not held in crowns.
      currency: abroad ? 'EUR' : typed.currency,
    });
  }

  return (
    <StepFrame
      title={labels.title}
      text={labels.text}
      secondary={
        <Link href={backHref} className={secondaryLink}>
          <ArrowLeft />
          {labels.back}
        </Link>
      }
    >
      <Form
        className="flex flex-col gap-4"
        onChange={() => {
          setErrorCode(undefined);
        }}
        onFields={(formData) => {
          if (!method) {
            setErrorCode(nothingChosen);

            return;
          }

          startTransition(async () => {
            // One button does what is left: saves the bank account, then starts the check of the provider.
            const steps = [
              typingBankAccount
                ? () => saveBankAccount(typed.iban, textOf(formData, 'holderName'), typed.currency)
                : undefined,
              status === 'INCOMPLETE' ? finishForm : undefined,
            ];

            for (const step of steps) {
              const result = await step?.();

              if (result && !result.ok) {
                setErrorCode(result.code);

                return;
              }
            }

            setChangingBankAccount(false);
            setTyped(emptyAccount(czechSeller));
            router.push(nextHref);
          });
        }}
      >
        <fieldset className="flex flex-col gap-2.5" disabled={busy}>
          <legend className="sr-only">{labels.title}</legend>
          {methods.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3.5 rounded-md border-[1.5px] px-4 py-3.5 transition-colors has-focus-visible:ring-4 has-focus-visible:ring-berry-500/14 ${
                method === option
                  ? 'border-berry-500 bg-berry-50'
                  : 'border-gray-200 bg-white hover:border-berry-300'
              }`}
            >
              <input
                type="radio"
                name="method"
                value={option}
                className="sr-only"
                checked={method === option}
                onChange={() => {
                  setChangingBankAccount(false);
                  startTransition(async () => {
                    const result = await chooseMethod(option);

                    setErrorCode(result.ok ? undefined : result.code);
                  });
                }}
              />
              <span
                className={`flex size-10 flex-none items-center justify-center rounded-sm [&_svg]:size-5 ${
                  method === option ? 'bg-berry-500 text-white' : 'bg-berry-100 text-berry-600'
                }`}
              >
                {methodIcons[option]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-extrabold">{labels.methods[option].title}</span>
                <span className="text-[13px] font-semibold text-gray-600">
                  {labels.methods[option].text}
                </span>
              </span>
              <span
                aria-hidden
                className={`flex size-5 flex-none items-center justify-center rounded-full border-[1.8px] [&_svg]:size-3 [&_svg]:stroke-[3.5] ${
                  method === option
                    ? 'border-berry-500 bg-berry-500 text-white'
                    : 'border-gray-300 text-transparent'
                }`}
              >
                <Check />
              </span>
            </label>
          ))}
        </fieldset>

        {typingBankAccount ? (
          <div className="flex animate-step-in flex-col gap-4">
            {czechSeller ? (
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <TextField
                  label={labels.accountNumberLabel}
                  icon={<Landmark />}
                  name="accountNumber"
                  autoComplete="off"
                  inputMode="numeric"
                  pattern={accountNumberAsTyped}
                  maxLength={21}
                  value={typed.accountNumber}
                  onChange={(event) => {
                    typeCzechAccount(event.target.value, typed.bankCode);
                  }}
                />
                <TextField
                  label={labels.bankCodeLabel}
                  name="bankCode"
                  autoComplete="off"
                  inputMode="numeric"
                  pattern={bankCodeAsTyped}
                  maxLength={4}
                  value={typed.bankCode}
                  onChange={(event) => {
                    typeCzechAccount(typed.accountNumber, event.target.value);
                  }}
                />
              </div>
            ) : null}
            <TextField
              label={labels.ibanLabel}
              icon={czechSeller ? undefined : <Landmark />}
              name="iban"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              pattern={ibanAsTyped}
              maxLength={42}
              value={typed.iban}
              onChange={(event) => {
                typeIban(event.target.value);
              }}
            />
            <OptionBoxes
              label={labels.currencyLabel}
              name="currency"
              options={currencies.map((currency) => ({ value: currency, label: currency }))}
              value={typed.currency}
              onChange={(currency) => {
                setTyped({ ...typed, currency });
              }}
            />
            <TextField
              label={labels.holderLabel}
              icon={<User />}
              name="holderName"
              autoComplete="off"
              required
              minLength={2}
              maxLength={140}
              defaultValue={bankAccount?.holderName ?? legalName}
            />
          </div>
        ) : null}

        {method === 'BANK' && bankAccount && !changingBankAccount ? (
          <DoneRow
            action={
              <TextButton
                onClick={() => {
                  setChangingBankAccount(true);
                }}
              >
                {labels.changeBankAccount}
              </TextButton>
            }
          >
            {labels.bankAccountSaved
              .replace('{country}', bankAccount.country)
              .replace('{last4}', bankAccount.last4)
              .replace('{currency}', bankAccount.currency)}
          </DoneRow>
        ) : null}

        {method ? (
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-gray-600 [&_svg]:size-4 [&_svg]:flex-none">
            {status === 'INCOMPLETE' ? (
              <>
                <FlaskConical />
                {labels.simulation}
              </>
            ) : (
              <Badge tone={status === 'VERIFIED' ? 'green' : 'amber'}>
                {status === 'VERIFIED' ? <Check /> : <Clock3 />}
                {labels.statuses[status]}
              </Badge>
            )}
          </p>
        ) : null}

        {error ? <FormError>{error}</FormError> : null}

        <SubmitButton busy={busy} icon={<ArrowRight />}>
          {labels.continue}
        </SubmitButton>
      </Form>
    </StepFrame>
  );
}

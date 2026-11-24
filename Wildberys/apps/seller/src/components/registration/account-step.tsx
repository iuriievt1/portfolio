'use client';

import { Button, TextButton } from '@bluberi/ui/components/button';
import { Checkbox } from '@bluberi/ui/components/checkbox';
import { CodeField } from '@bluberi/ui/components/code-field';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { PasswordField, type PasswordToggleLabels } from '@bluberi/ui/components/password-field';
import { ResendCode, type ResendCodeLabels } from '@bluberi/ui/components/resend-code';
import { TextField } from '@bluberi/ui/components/text-field';
import { formatPhone, phoneStart } from '@bluberi/web-auth/phone';
import type { ActionResult, CodeSent, SignInStart } from '@bluberi/web-auth/session';
import { ArrowRight, Mail, Phone } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import { useRegistrationDraft, type SentCode } from '../../registration/draft';
import { DoneRow, errorText, secondaryLink, StepFrame, SubmitButton, textOf } from './step-frame';

/** The code the API answers with when the first password is set too long after the sign-in. */
const signInTooLongAgo = 'RECENT_SIGN_IN_REQUIRED';

export interface AccountStepLabels {
  readonly title: string;
  readonly emailText: string;
  readonly emailLabel: string;
  /** Has the place {email}. */
  readonly emailCodeText: string;
  readonly codeLabel: string;
  readonly changeEmail: string;
  readonly existingAccount: string;
  readonly phoneText: string;
  readonly phoneLabel: string;
  readonly sendCode: string;
  /** Has the place {phone}. */
  readonly smsCodeText: string;
  readonly changePhone: string;
  readonly confirm: string;
  readonly passwordText: string;
  readonly passwordLabel: string;
  /** Has the place {count}. */
  readonly passwordHint: string;
  readonly passwordSaved: string;
  readonly readyText: string;
  readonly signInAgain: string;
  readonly haveAccount: string;
  readonly signIn: string;
  readonly continue: string;
}

interface Account {
  readonly email: string;
  readonly phone: string | null;
  readonly phoneVerified: boolean;
  readonly hasPassword: boolean;
}

interface AccountStepProps {
  /** The signed-in person. Null until the email is confirmed with a code. */
  readonly account: Account | null;
  readonly labels: AccountStepLabels;
  readonly resendLabels: ResendCodeLabels;
  readonly passwordToggleLabels: PasswordToggleLabels;
  /** The sentence about the terms for sellers, with its link. */
  readonly terms: ReactNode;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly codeLength: number;
  readonly passwordMinLength: number;
  readonly nextHref: Route;
  readonly signInHref: Route;
  readonly signOutHref: Route;
  /** Server action: sends a sign-in code to the email, or says the account has a password. */
  readonly startSignIn: (email: string) => Promise<ActionResult<SignInStart>>;
  /** Server action: signs in with the code from the email. The first sign-in makes the account. */
  readonly signIn: (email: string, code: string) => Promise<ActionResult>;
  readonly sendPhoneCode: (phone: string) => Promise<ActionResult<CodeSent>>;
  readonly confirmPhone: (phone: string, code: string) => Promise<ActionResult>;
  readonly savePassword: (newPassword: string, currentPassword: undefined) => Promise<ActionResult>;
}

function sentTo(to: string, sent: CodeSent): SentCode {
  return { to, resendAt: Date.now() + sent.resendInSeconds * 1000 };
}

/**
 * Step 1 of the registration: the account. One thing is asked at a time: the email and its code,
 * the phone and its code, then the password. What is done stays above as a quiet line.
 */
export function AccountStep({
  account,
  labels,
  resendLabels,
  passwordToggleLabels,
  terms,
  errors,
  codeLength,
  passwordMinLength,
  nextHref,
  signInHref,
  signOutHref,
  startSignIn,
  signIn,
  sendPhoneCode,
  confirmPhone,
  savePassword,
}: AccountStepProps) {
  const router = useRouter();
  const [draft, keep] = useRegistrationDraft();
  const [errorCode, setErrorCode] = useState<string>();
  const [existingAccount, setExistingAccount] = useState(false);
  // A new field after a wrong code, so the wrong digits are cleared.
  const [attempt, setAttempt] = useState(0);
  const [changingPhone, setChangingPhone] = useState(false);
  const [busy, startTransition] = useTransition();
  const error = errorText(errors, errorCode);

  const emailCode = account ? undefined : draft.emailCode;
  const phoneConfirmed = account?.phoneVerified === true && !changingPhone;
  const phoneCode = account && !phoneConfirmed ? draft.phoneCode : undefined;
  const termsBox = (
    <Checkbox
      label={<span className="text-[13px] leading-normal font-semibold">{terms}</span>}
      required
      checked={draft.termsAccepted === true}
      onChange={(event) => {
        keep({ termsAccepted: event.target.checked });
      }}
    />
  );

  /** Runs a server action and shows its error. */
  function run<Value>(
    action: () => Promise<ActionResult<Value>>,
    onDone: (value: Value) => void,
  ): void {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        setErrorCode(undefined);
        onDone(result.value);
      } else {
        setErrorCode(result.code);
        setAttempt((count) => count + 1);
      }
    });
  }

  function sendEmailCode(to: string): void {
    setExistingAccount(false);
    run(
      () => startSignIn(to),
      (start) => {
        if (start.step === 'EMAIL_CODE') {
          keep({ email: to, emailCode: sentTo(to, start.sent) });
        } else {
          // The account has a password: its owner signs in, nobody else gets a code for it here.
          setExistingAccount(true);
        }
      },
    );
  }

  function sendSmsCode(to: string): void {
    run(
      () => sendPhoneCode(to),
      (sent) => {
        keep({ phone: to, phoneCode: sentTo(to, sent) });
      },
    );
  }

  const failure = (
    <>
      {error ? <FormError>{error}</FormError> : null}
      {errorCode === signInTooLongAgo ? (
        // A plain form: the answer loads the sign-in page in full.
        <form method="post" action={signOutHref}>
          <Button type="submit" variant="soft" className="w-full">
            {labels.signInAgain}
          </Button>
        </form>
      ) : null}
    </>
  );

  if (!account && emailCode) {
    return (
      <StepFrame title={labels.title} text={labels.emailCodeText.replace('{email}', emailCode.to)}>
        <CodeForm
          key={`email-${String(attempt)}`}
          label={labels.codeLabel}
          sent={emailCode}
          codeLength={codeLength}
          busy={busy}
          confirmLabel={labels.confirm}
          changeLabel={labels.changeEmail}
          resendLabels={resendLabels}
          failure={failure}
          onResend={() => {
            sendEmailCode(emailCode.to);
          }}
          onChange={() => {
            setErrorCode(undefined);
            keep({ emailCode: undefined });
          }}
          onCode={(code) => {
            run(
              () => signIn(emailCode.to, code),
              () => {
                keep({ emailCode: undefined });
                // The page is drawn again for the signed-in person. An account that is registered already goes on from here.
                router.refresh();
              },
            );
          }}
        />
      </StepFrame>
    );
  }

  if (!account) {
    return (
      <StepFrame
        title={labels.title}
        text={labels.emailText}
        secondary={
          <span>
            {labels.haveAccount}{' '}
            <Link href={signInHref} className={secondaryLink}>
              {labels.signIn}
            </Link>
          </span>
        }
      >
        <Form
          className="flex flex-col gap-4"
          onFields={(formData) => {
            sendEmailCode(textOf(formData, 'email'));
          }}
        >
          <TextField
            label={labels.emailLabel}
            icon={<Mail />}
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={draft.email ?? ''}
            onChange={(event) => {
              keep({ email: event.target.value });
            }}
          />
          {existingAccount ? (
            <p className="rounded-sm bg-berry-50 px-4 py-3 text-sm font-semibold text-berry-700">
              {labels.existingAccount}
            </p>
          ) : null}
          {failure}
          <SubmitButton busy={busy} icon={<ArrowRight />}>
            {labels.continue}
          </SubmitButton>
        </Form>
      </StepFrame>
    );
  }

  const emailRow = <DoneRow>{account.email}</DoneRow>;

  if (phoneCode) {
    return (
      <StepFrame
        title={labels.title}
        text={labels.smsCodeText.replace('{phone}', formatPhone(phoneCode.to))}
      >
        {emailRow}
        <CodeForm
          key={`phone-${String(attempt)}`}
          label={labels.codeLabel}
          sent={phoneCode}
          codeLength={codeLength}
          busy={busy}
          confirmLabel={labels.confirm}
          changeLabel={labels.changePhone}
          resendLabels={resendLabels}
          failure={failure}
          onResend={() => {
            sendSmsCode(phoneCode.to);
          }}
          onChange={() => {
            setErrorCode(undefined);
            keep({ phoneCode: undefined });
          }}
          onCode={(code) => {
            run(
              () => confirmPhone(phoneCode.to, code),
              () => {
                setChangingPhone(false);
                keep({ phone: undefined, phoneCode: undefined });
              },
            );
          }}
        />
      </StepFrame>
    );
  }

  if (!phoneConfirmed) {
    return (
      <StepFrame title={labels.title} text={labels.phoneText}>
        {emailRow}
        <Form
          className="flex flex-col gap-4"
          onFields={(formData) => {
            sendSmsCode(textOf(formData, 'phone'));
          }}
        >
          <TextField
            label={labels.phoneLabel}
            icon={<Phone />}
            type="tel"
            name="phone"
            autoComplete="tel"
            required
            value={draft.phone ?? phoneStart}
            onChange={(event) => {
              keep({ phone: event.target.value });
            }}
          />
          {failure}
          <SubmitButton busy={busy} icon={<ArrowRight />}>
            {labels.sendCode}
          </SubmitButton>
        </Form>
      </StepFrame>
    );
  }

  const phoneRow = (
    <DoneRow
      action={
        <TextButton
          onClick={() => {
            setErrorCode(undefined);
            setChangingPhone(true);
          }}
        >
          {labels.changePhone}
        </TextButton>
      }
    >
      {account.phone ? formatPhone(account.phone) : null}
    </DoneRow>
  );

  return (
    <StepFrame
      title={labels.title}
      text={account.hasPassword ? labels.readyText : labels.passwordText}
    >
      {emailRow}
      {phoneRow}
      {account.hasPassword ? <DoneRow>{labels.passwordSaved}</DoneRow> : null}
      <Form
        className="flex flex-col gap-4"
        onFields={(formData) => {
          if (account.hasPassword) {
            router.push(nextHref);

            return;
          }

          run(
            () => savePassword(textOf(formData, 'newPassword'), undefined),
            () => {
              router.push(nextHref);
            },
          );
        }}
      >
        {account.hasPassword ? null : (
          <PasswordField
            label={labels.passwordLabel}
            toggleLabels={passwordToggleLabels}
            hint={labels.passwordHint.replace('{count}', String(passwordMinLength))}
            name="newPassword"
            autoComplete="new-password"
            minLength={passwordMinLength}
            required
          />
        )}
        {termsBox}
        {failure}
        <SubmitButton busy={busy} icon={<ArrowRight />}>
          {labels.continue}
        </SubmitButton>
      </Form>
    </StepFrame>
  );
}

interface CodeFormProps {
  readonly label: string;
  readonly sent: SentCode;
  readonly codeLength: number;
  readonly busy: boolean;
  readonly confirmLabel: string;
  readonly changeLabel: string;
  readonly resendLabels: ResendCodeLabels;
  /** The error of the last try, if there was one. */
  readonly failure: ReactNode;
  readonly onResend: () => void;
  /** The person wants to type another address. */
  readonly onChange: () => void;
  readonly onCode: (code: string) => void;
}

/** A code that was sent: its boxes, the button, and how to get another code or change the address. */
function CodeForm({
  label,
  sent,
  codeLength,
  busy,
  confirmLabel,
  changeLabel,
  resendLabels,
  failure,
  onResend,
  onChange,
  onCode,
}: CodeFormProps) {
  return (
    <Form
      className="flex flex-col gap-4"
      onFields={(formData) => {
        onCode(textOf(formData, 'code'));
      }}
    >
      <CodeField name="code" label={label} length={codeLength} />
      {failure}
      <SubmitButton busy={busy}>{confirmLabel}</SubmitButton>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ResendCode
          labels={resendLabels}
          resendAt={sent.resendAt}
          disabled={busy}
          onResend={onResend}
        />
        <TextButton onClick={onChange}>{changeLabel}</TextButton>
      </div>
    </Form>
  );
}

'use client';

import { ArrowRight, Mail } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState, useTransition, type ReactNode } from 'react';

import { Button, TextButton } from './button';
import { CodeField } from './code-field';
import { Form } from './form';
import { FormError } from './form-error';
import { pageFadeTransition } from './page-fade';
import { PasswordField, type PasswordToggleLabels } from './password-field';
import { forgetPendingSignIn, savePendingSignIn, usePendingSignIn } from './pending-sign-in';
import { ResendCode } from './resend-code';
import { TextField } from './text-field';

type Result<Value = undefined> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly code: string };

interface CodeSent {
  readonly resendInSeconds: number;
  readonly expiresInSeconds: number;
}

/** What a sign-in asks for after the email: the password of the account, or the code that was just sent. */
type SignInStart =
  { readonly step: 'PASSWORD' } | { readonly step: 'EMAIL_CODE'; readonly sent: CodeSent };

interface ConfirmationSent extends CodeSent {
  readonly channel: 'EMAIL' | 'SMS';
  readonly phoneEnding: string | null;
}

export interface SignInLabels {
  readonly emailTitle: string;
  readonly emailText: string;
  readonly emailLabel: string;
  readonly continue: string;
  readonly codeTitle: string;
  /** Has the place {email} for the address the code was sent to. */
  readonly codeText: string;
  readonly codeLabel: string;
  readonly submit: string;
  /** Has the place {time} for the minutes and seconds left. */
  readonly resendIn: string;
  readonly resend: string;
  readonly changeEmail: string;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
}

export interface PasswordSignInLabels {
  readonly passwordTitle: string;
  /** Has the place {email} for the account that signs in. */
  readonly passwordText: string;
  readonly passwordLabel: string;
  readonly forgotPassword: string;
  readonly confirmationTitle: string;
  /** Has the place {email} for the address the code was sent to. */
  readonly confirmationByEmail: string;
  /** Has the place {digits} for the end of the phone number the code was sent to. */
  readonly confirmationBySms: string;
  readonly resetTitle: string;
  /** Has the place {email} for the address the code was sent to. */
  readonly resetText: string;
  readonly newPasswordLabel: string;
  readonly saveAndSignIn: string;
}

export interface PasswordFieldLabels extends PasswordToggleLabels {
  /** Has the place {count} for the shortest password allowed. */
  readonly hint: string;
}

/** Sign-in for accounts that have a password: the password, then a code as the second step. */
interface PasswordSignIn {
  readonly labels: PasswordSignInLabels;
  readonly fieldLabels: PasswordFieldLabels;
  /** The shortest password allowed. */
  readonly minLength: number;
  /** Server action: finds out whether the account has a password. If not, a code is sent at once. */
  readonly start: (email: string) => Promise<Result<SignInStart>>;
  /** Server action: checks the password and sends the code of the second step. */
  readonly signIn: (email: string, password: string) => Promise<Result<ConfirmationSent>>;
  /** Server action: sends the code of the second step again. */
  readonly resendConfirmation: () => Promise<Result<CodeSent>>;
  /** Server action: finishes the sign-in with the code of the second step and saves the session. */
  readonly confirm: (code: string) => Promise<Result>;
  /** Server action: sends a code for a forgotten password to the email. */
  readonly requestResetCode: (email: string) => Promise<Result<CodeSent>>;
  /** Server action: sets a new password with that code and signs in. */
  readonly reset: (email: string, code: string, newPassword: string) => Promise<Result>;
}

interface SignInFormProps {
  readonly labels: SignInLabels;
  /** How many digits a code has. */
  readonly codeLength: number;
  /** Where to go after a successful sign-in. */
  readonly afterSignInHref: Route;
  /** Server action: sends a sign-in code to the email. */
  readonly requestCode: (email: string) => Promise<Result<CodeSent>>;
  /** Server action: signs in with the code from the email and saves the session. */
  readonly signIn: (email: string, code: string) => Promise<Result>;
  /** Left out in an app where people sign in with a code only. */
  readonly password?: PasswordSignIn;
}

/** The API answers with this code when the password step was too long ago. */
const confirmationExpired = 'SIGN_IN_CONFIRMATION_EXPIRED';

/** When a code that was just sent can be asked for again and when it stops working. */
function timingOf(sent: CodeSent): { resendAt: number; expiresAt: number } {
  const now = Date.now();

  return {
    resendAt: now + sent.resendInSeconds * 1000,
    expiresAt: now + sent.expiresInSeconds * 1000,
  };
}

function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === 'string' ? value : '';
}

/**
 * Sign-in in steps. It starts with the email. An account without a password gets a code
 * by email. An account with a password is asked for it, then for a code as the second step.
 * The step survives a reload of the page and a change of language.
 */
export function SignInForm({
  labels,
  codeLength,
  afterSignInHref,
  requestCode,
  signIn,
  password,
}: SignInFormProps) {
  const router = useRouter();
  const pending = usePendingSignIn();
  const [attempt, setAttempt] = useState(0);
  const [errorCode, setErrorCode] = useState<string>();
  const [working, startTransition] = useTransition();
  // After a sign-in the form stays as it is, with its button off, until the app takes its place.
  const [leaving, setLeaving] = useState(false);
  const signedInNow = useRef(false);
  const busy = working || leaving;
  const error = errorCode ? (labels.errors[errorCode] ?? labels.errors.UNKNOWN) : undefined;

  useLayoutEffect(
    () => () => {
      // The form leaves the screen. Next.js keeps a page it has shown and may show it again,
      // so after a sign-in the form is made ready for the next visit: it starts with the email.
      if (signedInNow.current) {
        signedInNow.current = false;
        forgetPendingSignIn();
        setLeaving(false);
      }
    },
    [],
  );

  function run<Value>(
    action: () => Promise<Result<Value>>,
    onDone: (value: Value) => void,
    onFailed?: (code: string) => void,
  ): void {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        setErrorCode(undefined);
        onDone(result.value);
      } else {
        setErrorCode(result.code);
        onFailed?.(result.code);
      }
    });
  }

  function signedIn(): void {
    signedInNow.current = true;
    setLeaving(true);
    // The page is not loaded anew: the sign-in screen fades into the app.
    router.replace(afterSignInHref, { transitionTypes: [pageFadeTransition] });
  }

  /** A new field, so the wrong code is cleared. */
  function clearCode(): void {
    setAttempt((count) => count + 1);
  }

  function startOver(from: string): void {
    savePendingSignIn({ step: 'email', email: from });
    setErrorCode(undefined);
  }

  const form = 'mt-8.5 flex max-w-130 animate-step-in flex-col';
  const submitButton = (label: string): ReactNode => (
    <Button type="submit" size="lg" className="mt-6 self-start" disabled={busy}>
      {label}
      <ArrowRight />
    </Button>
  );

  if (!pending || pending.step === 'email') {
    // Kept with the steps, so the email a person is typing stays when they change the language.
    const email = pending?.email ?? '';

    return (
      <Form
        key="email"
        onFields={() => {
          if (password) {
            run(
              () => password.start(email),
              (start) => {
                savePendingSignIn(
                  start.step === 'PASSWORD'
                    ? { step: 'password', email }
                    : { step: 'code', email, ...timingOf(start.sent) },
                );
              },
            );
          } else {
            run(
              () => requestCode(email),
              (sent) => {
                savePendingSignIn({ step: 'code', email, ...timingOf(sent) });
              },
            );
          }
        }}
        className={form}
      >
        <StepHeading title={labels.emailTitle} text={labels.emailText} />
        <TextField
          className="mt-6.5"
          label={labels.emailLabel}
          icon={<Mail />}
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(event) => {
            savePendingSignIn({ step: 'email', email: event.target.value });
          }}
        />
        {error ? <FormError>{error}</FormError> : null}
        {submitButton(labels.continue)}
      </Form>
    );
  }

  const account = pending.email;
  const changeEmail = (
    <TextButton
      onClick={() => {
        startOver(account);
      }}
    >
      {labels.changeEmail}
    </TextButton>
  );
  /** Sends a code to the email and shows the step that waits for it. */
  const sendByEmail = (
    step: 'code' | 'reset',
    send: (email: string) => Promise<Result<CodeSent>>,
  ): void => {
    run(
      () => send(account),
      (sent) => {
        savePendingSignIn({ step, email: account, ...timingOf(sent) });
      },
    );
  };

  if (pending.step === 'code') {
    return (
      <Form
        key="code"
        onFields={(formData) => {
          run(() => signIn(account, textOf(formData, 'code')), signedIn, clearCode);
        }}
        className={form}
      >
        <StepHeading title={labels.codeTitle} text={labels.codeText.replace('{email}', account)} />
        <div className="mt-6.5">
          <CodeField key={attempt} name="code" label={labels.codeLabel} length={codeLength} />
        </div>
        <StepLinks>
          <ResendCode
            labels={labels}
            resendAt={pending.resendAt}
            disabled={busy}
            onResend={() => {
              sendByEmail('code', requestCode);
            }}
          />
          {changeEmail}
        </StepLinks>
        {error ? <FormError>{error}</FormError> : null}
        {submitButton(labels.submit)}
      </Form>
    );
  }

  if (!password) {
    // A step of the sign-in with a password, left in the tab by an app that has one.
    return null;
  }

  const backToPassword = (code: string): void => {
    if (code === confirmationExpired) {
      savePendingSignIn({ step: 'password', email: account });
    } else {
      clearCode();
    }
  };

  if (pending.step === 'password') {
    return (
      <Form
        key="password"
        onFields={(formData) => {
          run(
            () => password.signIn(account, textOf(formData, 'password')),
            (sent) => {
              savePendingSignIn({
                step: 'confirmation',
                email: account,
                channel: sent.channel,
                phoneEnding: sent.phoneEnding,
                ...timingOf(sent),
              });
            },
          );
        }}
        className={form}
      >
        <StepHeading
          title={password.labels.passwordTitle}
          text={password.labels.passwordText.replace('{email}', account)}
        />
        {/* Password managers look for the account next to the password. */}
        <input type="email" name="email" autoComplete="username" value={account} readOnly hidden />
        <PasswordField
          className="mt-6.5"
          label={password.labels.passwordLabel}
          toggleLabels={password.fieldLabels}
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <StepLinks>
          <TextButton
            disabled={busy}
            onClick={() => {
              sendByEmail('reset', password.requestResetCode);
            }}
          >
            {password.labels.forgotPassword}
          </TextButton>
          {changeEmail}
        </StepLinks>
        {error ? <FormError>{error}</FormError> : null}
        {submitButton(labels.submit)}
      </Form>
    );
  }

  if (pending.step === 'confirmation') {
    return (
      <Form
        key="confirmation"
        onFields={(formData) => {
          run(() => password.confirm(textOf(formData, 'code')), signedIn, backToPassword);
        }}
        className={form}
      >
        <StepHeading
          title={password.labels.confirmationTitle}
          text={
            pending.channel === 'SMS' && pending.phoneEnding !== null
              ? password.labels.confirmationBySms.replace('{digits}', pending.phoneEnding)
              : password.labels.confirmationByEmail.replace('{email}', account)
          }
        />
        <div className="mt-6.5">
          <CodeField key={attempt} name="code" label={labels.codeLabel} length={codeLength} />
        </div>
        <StepLinks>
          <ResendCode
            labels={labels}
            resendAt={pending.resendAt}
            disabled={busy}
            onResend={() => {
              run(
                password.resendConfirmation,
                (sent) => {
                  savePendingSignIn({ ...pending, ...timingOf(sent) });
                },
                backToPassword,
              );
            }}
          />
          {changeEmail}
        </StepLinks>
        {error ? <FormError>{error}</FormError> : null}
        {submitButton(labels.submit)}
      </Form>
    );
  }

  return (
    <Form
      key="reset"
      onFields={(formData) => {
        run(
          () => password.reset(account, textOf(formData, 'code'), textOf(formData, 'newPassword')),
          signedIn,
          clearCode,
        );
      }}
      className={form}
    >
      <StepHeading
        title={password.labels.resetTitle}
        text={password.labels.resetText.replace('{email}', account)}
      />
      <div className="mt-6.5">
        <CodeField key={attempt} name="code" label={labels.codeLabel} length={codeLength} />
      </div>
      <StepLinks>
        <ResendCode
          labels={labels}
          resendAt={pending.resendAt}
          disabled={busy}
          onResend={() => {
            sendByEmail('reset', password.requestResetCode);
          }}
        />
        {changeEmail}
      </StepLinks>
      <PasswordField
        className="mt-5"
        label={password.labels.newPasswordLabel}
        toggleLabels={password.fieldLabels}
        hint={password.fieldLabels.hint.replace('{count}', String(password.minLength))}
        name="newPassword"
        autoComplete="new-password"
        minLength={password.minLength}
        required
      />
      {error ? <FormError>{error}</FormError> : null}
      {submitButton(password.labels.saveAndSignIn)}
    </Form>
  );
}

function StepHeading({ title, text }: { readonly title: string; readonly text: string }) {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-[-0.02em]">{title}</h1>
      <p className="mt-1.5 text-[15px] font-medium text-gray-600">{text}</p>
    </>
  );
}

/** The small actions under a field: send the code again, change the email. */
function StepLinks({ children }: { readonly children: ReactNode }) {
  return <div className="mt-3.5 flex min-h-5 w-fit items-center gap-6">{children}</div>;
}

'use client';

import { Button, TextButton } from '@bluberi/ui/components/button';
import { CodeField } from '@bluberi/ui/components/code-field';
import { Dialog } from '@bluberi/ui/components/dialog';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { ResendCode, type ResendCodeLabels } from '@bluberi/ui/components/resend-code';
import { TextField } from '@bluberi/ui/components/text-field';
import { formatPhone, phoneStart } from '@bluberi/web-auth/phone';
import type { ActionResult, CodeSent } from '@bluberi/web-auth/session';
import { CircleCheck, Phone, Smartphone } from 'lucide-react';
import { useLayoutEffect, useState, useTransition } from 'react';

import { SecurityCard } from './security-card';

interface PhoneCardLabels {
  readonly title: string;
  readonly missing: string;
  readonly confirmed: string;
  readonly add: string;
  readonly change: string;
  readonly label: string;
  readonly hint: string;
  readonly sendCode: string;
  readonly codeTitle: string;
  /** Has the place {phone} for the number the code was sent to. */
  readonly codeText: string;
  readonly codeLabel: string;
  readonly confirm: string;
}

interface PhoneCardProps {
  /** The confirmed phone number of the account, if it has one. */
  readonly phone: string | null;
  /** True when the phone is the step to take next: the card then shows the main button. */
  readonly next: boolean;
  /** The place of the phone among the steps of securing the account, shown until it is confirmed. */
  readonly stepLabel: string;
  readonly labels: PhoneCardLabels;
  readonly resendLabels: ResendCodeLabels;
  /** How many digits a code has. */
  readonly codeLength: number;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly closeLabel: string;
  /** Server action: sends a code by SMS to the number. */
  readonly sendCode: (phone: string) => Promise<ActionResult<CodeSent>>;
  /** Server action: saves the number when the code from the SMS is right. */
  readonly confirm: (phone: string, code: string) => Promise<ActionResult>;
}

/** The number the code went to, and when another code can be asked for. */
interface SentCode {
  readonly phone: string;
  readonly resendAt: number;
}

function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === 'string' ? value : '';
}

/** The phone number of the account. A new number is saved after a code from an SMS proves it works. */
export function PhoneCard({
  phone,
  next,
  stepLabel,
  labels,
  resendLabels,
  codeLength,
  errors,
  closeLabel,
  sendCode,
  confirm,
}: PhoneCardProps) {
  const [open, setOpen] = useState(false);

  // Next.js keeps a page it has shown. The dialog does not stay open on a page that left the screen.
  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [],
  );

  // A new form every time the dialog opens, so nothing typed before is left in it.
  const [opened, setOpened] = useState(0);
  const [sent, setSent] = useState<SentCode>();
  const [attempt, setAttempt] = useState(0);
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();
  const error = errorCode ? (errors[errorCode] ?? errors.UNKNOWN) : undefined;
  const action = phone === null ? labels.add : labels.change;

  function send(to: string): void {
    startTransition(async () => {
      const result = await sendCode(to);

      if (result.ok) {
        setSent({ phone: to, resendAt: Date.now() + result.value.resendInSeconds * 1000 });
        setErrorCode(undefined);
      } else {
        setErrorCode(result.code);
      }
    });
  }

  return (
    <SecurityCard
      icon={<Smartphone />}
      title={labels.title}
      step={phone === null ? { label: stepLabel, next } : undefined}
      done={phone !== null}
      action={
        <Button
          variant={next ? 'primary' : 'soft'}
          onClick={() => {
            setSent(undefined);
            setErrorCode(undefined);
            setOpened((count) => count + 1);
            setOpen(true);
          }}
        >
          {action}
        </Button>
      }
    >
      {phone === null ? (
        labels.missing
      ) : (
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-berry-950">{formatPhone(phone)}</span>
          <span className="flex items-center gap-1 [&_svg]:size-4 [&_svg]:text-green-500">
            <CircleCheck />
            {labels.confirmed}
          </span>
        </span>
      )}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={sent ? labels.codeTitle : action}
        closeLabel={closeLabel}
      >
        {sent ? (
          <Form
            key={`code-${String(opened)}`}
            onFields={(formData) => {
              startTransition(async () => {
                const result = await confirm(sent.phone, textOf(formData, 'code'));

                if (result.ok) {
                  setOpen(false);
                } else {
                  setErrorCode(result.code);
                  // A new field, so the wrong code is cleared.
                  setAttempt((count) => count + 1);
                }
              });
            }}
            className="mt-1.5 flex flex-col"
          >
            <p className="text-[13px] font-semibold text-gray-600">
              {labels.codeText.replace('{phone}', sent.phone)}
            </p>
            <div className="mt-5">
              <CodeField key={attempt} name="code" label={labels.codeLabel} length={codeLength} />
            </div>
            <div className="mt-3.5 flex min-h-5 items-center gap-6">
              <ResendCode
                labels={resendLabels}
                resendAt={sent.resendAt}
                disabled={busy}
                onResend={() => {
                  send(sent.phone);
                }}
              />
              <TextButton
                onClick={() => {
                  setSent(undefined);
                  setErrorCode(undefined);
                }}
              >
                {labels.change}
              </TextButton>
            </div>
            {error ? <FormError>{error}</FormError> : null}
            <Button type="submit" className="mt-5 self-start" disabled={busy}>
              {labels.confirm}
            </Button>
          </Form>
        ) : (
          <Form
            key={`phone-${String(opened)}`}
            onFields={(formData) => {
              send(textOf(formData, 'phone').trim());
            }}
            className="mt-5 flex flex-col"
          >
            <TextField
              label={labels.label}
              hint={labels.hint}
              icon={<Phone />}
              type="tel"
              name="phone"
              autoComplete="tel"
              defaultValue={phoneStart}
              required
            />
            {error ? <FormError>{error}</FormError> : null}
            <Button type="submit" className="mt-5 self-start" disabled={busy}>
              {labels.sendCode}
            </Button>
          </Form>
        )}
      </Dialog>
    </SecurityCard>
  );
}

'use client';

import { Button } from '@bluberi/ui/components/button';
import { Dialog } from '@bluberi/ui/components/dialog';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { PasswordField } from '@bluberi/ui/components/password-field';
import type { PasswordFieldLabels } from '@bluberi/ui/components/sign-in-form';
import type { ActionResult } from '@bluberi/web-auth/session';
import { KeyRound } from 'lucide-react';
import { useId, useLayoutEffect, useState, useTransition } from 'react';

import { SecurityCard } from './security-card';

interface PasswordCardLabels {
  readonly title: string;
  readonly missing: string;
  readonly present: string;
  readonly add: string;
  readonly change: string;
  readonly currentLabel: string;
  readonly newLabel: string;
  readonly save: string;
}

interface PasswordCardProps {
  readonly hasPassword: boolean;
  /** The place of the password among the steps of securing the account, shown until it is set. */
  readonly stepLabel: string;
  readonly labels: PasswordCardLabels;
  readonly fieldLabels: PasswordFieldLabels;
  /** The shortest password allowed. */
  readonly minLength: number;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly closeLabel: string;
  readonly signInAgainLabel: string;
  /** Server action: sets the first password, or changes it with the current one. */
  readonly save: (newPassword: string, currentPassword?: string) => Promise<ActionResult>;
  /** The address that signs out, so the person can sign in again and set the password right after. */
  readonly signOutHref: string;
}

/** The API answers with this code when the first password is set too long after the sign-in. */
const signInTooLongAgo = 'RECENT_SIGN_IN_REQUIRED';

function textOf(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);

  return typeof value === 'string' ? value : undefined;
}

/** The password of the account: set the first one or change it, in a dialog. */
export function PasswordCard({
  hasPassword,
  stepLabel,
  labels,
  fieldLabels,
  minLength,
  errors,
  closeLabel,
  signInAgainLabel,
  save,
  signOutHref,
}: PasswordCardProps) {
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
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();
  const formId = useId();
  const error = errorCode ? (errors[errorCode] ?? errors.UNKNOWN) : undefined;
  const action = hasPassword ? labels.change : labels.add;

  return (
    <SecurityCard
      icon={<KeyRound />}
      title={labels.title}
      step={hasPassword ? undefined : { label: stepLabel, next: true }}
      done={hasPassword}
      action={
        <Button
          variant={hasPassword ? 'soft' : 'primary'}
          onClick={() => {
            setErrorCode(undefined);
            setOpened((count) => count + 1);
            setOpen(true);
          }}
        >
          {action}
        </Button>
      }
    >
      {hasPassword ? labels.present : labels.missing}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={action}
        closeLabel={closeLabel}
      >
        <Form
          key={opened}
          id={formId}
          onFields={(formData) => {
            startTransition(async () => {
              const result = await save(
                textOf(formData, 'newPassword') ?? '',
                textOf(formData, 'currentPassword'),
              );

              if (result.ok) {
                setOpen(false);
              } else {
                setErrorCode(result.code);
              }
            });
          }}
          className="mt-5 flex flex-col gap-4"
        >
          {hasPassword ? (
            <PasswordField
              label={labels.currentLabel}
              toggleLabels={fieldLabels}
              name="currentPassword"
              autoComplete="current-password"
              required
            />
          ) : null}
          <PasswordField
            label={labels.newLabel}
            toggleLabels={fieldLabels}
            hint={fieldLabels.hint.replace('{count}', String(minLength))}
            name="newPassword"
            autoComplete="new-password"
            minLength={minLength}
            required
          />
        </Form>
        {error ? <FormError>{error}</FormError> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="submit" form={formId} disabled={busy}>
            {labels.save}
          </Button>
          {errorCode === signInTooLongAgo ? (
            // A plain form: the answer loads the sign-in page in full.
            <form method="post" action={signOutHref}>
              <Button type="submit" variant="soft">
                {signInAgainLabel}
              </Button>
            </form>
          ) : null}
        </div>
      </Dialog>
    </SecurityCard>
  );
}

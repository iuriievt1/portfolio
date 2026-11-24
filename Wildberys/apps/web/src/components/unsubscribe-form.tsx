'use client';

import { Button, buttonClasses } from '@bluberi/ui/components/button';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { TextField } from '@bluberi/ui/components/text-field';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { CheckIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react/ssr';
import { useState, useTransition } from 'react';

import { Link } from '../i18n/navigation';
import { signUpProgress } from '../newsletter/sign-up-progress';
import { unsubscribeProgress, type UnsubscribeProgress } from '../newsletter/unsubscribe-progress';

export interface UnsubscribeLabels {
  readonly email: string;
  readonly submit: string;
  readonly done: { readonly title: string; readonly text: string };
  /** The link back to the first page. */
  readonly home: string;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
}

interface UnsubscribeFormProps {
  readonly labels: UnsubscribeLabels;
  /** Server action: stops the news for the email. */
  readonly leave: (email: string) => Promise<ActionResult>;
}

const notStarted: UnsubscribeProgress = { done: false, email: '' };

/**
 * Takes an email off the list for news: the person takes back the consent to get them.
 * The answer is the same whether the email was on the list or not.
 */
export function UnsubscribeForm({ labels, leave }: UnsubscribeFormProps) {
  const removal = unsubscribeProgress.useValue() ?? notStarted;
  const [errorCode, setErrorCode] = useState<string>();
  const [working, startTransition] = useTransition();
  const error = errorCode ? (labels.errors[errorCode] ?? labels.errors.UNKNOWN) : undefined;

  if (removal.done) {
    return (
      <div className="mt-6 flex animate-step-in flex-col items-start gap-5">
        <div role="status" className="flex items-center gap-3.5">
          <span className="flex size-12 flex-none items-center justify-center rounded-full bg-green-100 text-green-500">
            <CheckIcon aria-hidden weight="bold" className="size-6" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg leading-tight font-extrabold">{labels.done.title}</span>
            <span className="text-sm font-semibold text-gray-600">{labels.done.text}</span>
          </span>
        </div>
        <Link href="/" className={buttonClasses({ variant: 'outline', pill: true })}>
          {labels.home}
        </Link>
      </div>
    );
  }

  return (
    <Form
      className="mt-6 flex max-w-110 flex-col"
      onFields={() => {
        startTransition(async () => {
          const result = await leave(removal.email);

          if (result.ok) {
            setErrorCode(undefined);
            // The footer of this tab shows its form again, not "you are signed up".
            signUpProgress.save(undefined);
            unsubscribeProgress.save({ done: true, at: Date.now() });
          } else {
            setErrorCode(result.code);
          }
        });
      }}
    >
      <TextField
        label={labels.email}
        icon={<EnvelopeSimpleIcon />}
        type="email"
        name="email"
        autoComplete="email"
        required
        maxLength={254}
        value={removal.email}
        onChange={(event) => {
          unsubscribeProgress.save({ done: false, email: event.target.value });
        }}
      />
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" pill className="mt-5 self-start" disabled={working}>
        {labels.submit}
      </Button>
    </Form>
  );
}

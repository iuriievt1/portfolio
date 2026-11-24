'use client';

import { Button } from '@bluberi/ui/components/button';
import { Checkbox } from '@bluberi/ui/components/checkbox';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react/ssr';
import { useId, useState, useTransition, type ReactNode } from 'react';

import { trackEvent } from '../consent/analytics';
import { signUpProgress, type SignUpProgress } from '../newsletter/sign-up-progress';

export interface NewsletterLabels {
  readonly email: string;
  readonly submit: string;
  /** What the person agrees to, with the link to the privacy policy. */
  readonly consent: ReactNode;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly joined: { readonly title: string; readonly text: string };
}

interface NewsletterFormProps {
  readonly labels: NewsletterLabels;
  /** Server action: signs the email up for the news. */
  readonly join: (email: string, consent: boolean) => Promise<ActionResult>;
  /** The space between the form and what stands before it. */
  readonly className?: string;
}

const notStarted: SignUpProgress = { joined: false, email: '', consent: false };

/**
 * The sign-up for news by email in the footer of the store: the email and the consent.
 * What a person typed stays over a reload of the page and a change of language.
 */
export function NewsletterForm({ labels, join, className = '' }: NewsletterFormProps) {
  const progress = signUpProgress.useValue() ?? notStarted;
  const [errorCode, setErrorCode] = useState<string>();
  const [working, startTransition] = useTransition();
  const emailId = useId();
  const error = errorCode ? (labels.errors[errorCode] ?? labels.errors.UNKNOWN) : undefined;

  if (progress.joined) {
    return (
      <p role="status" className={`flex animate-step-in items-start gap-3 ${className}`}>
        <CheckCircleIcon weight="fill" aria-hidden className="size-6 flex-none text-green-500" />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold text-white">{labels.joined.title}</span>
          <span className="text-sm font-medium text-white/65">{labels.joined.text}</span>
        </span>
      </p>
    );
  }

  return (
    <Form
      className={className}
      onFields={() => {
        startTransition(async () => {
          const result = await join(progress.email, progress.consent);

          if (result.ok) {
            setErrorCode(undefined);
            signUpProgress.save({ joined: true });
            trackEvent('newsletter_subscribe');
          } else {
            setErrorCode(result.code);
          }
        });
      }}
    >
      <div className="flex gap-2">
        <label
          htmlFor={emailId}
          className="flex h-11 min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-full border-[1.5px] border-white/20 bg-white/6 px-4 transition-colors focus-within:border-berry-300"
        >
          <EnvelopeSimpleIcon aria-hidden className="size-4.5 flex-none text-white/45" />
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder={labels.email}
            aria-label={labels.email}
            value={progress.email}
            onChange={(event) => {
              signUpProgress.save({ ...progress, email: event.target.value });
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/45"
          />
        </label>
        <Button type="submit" pill className="flex-none" disabled={working}>
          {labels.submit}
        </Button>
      </div>
      <Checkbox
        tone="dark"
        className="mt-3.5"
        name="consent"
        required
        label={labels.consent}
        checked={progress.consent}
        onChange={(event) => {
          signUpProgress.save({ ...progress, consent: event.target.checked });
        }}
      />
      {error ? <FormError>{error}</FormError> : null}
    </Form>
  );
}

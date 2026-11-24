'use client';

import { FormError } from '@bluberi/ui/components/form-error';
import { Segmented, segmentedOptionClasses } from '@bluberi/ui/components/segmented';
import type { ActionResult } from '@bluberi/web-auth/session';
import { MessageSquareText } from 'lucide-react';
import { useState, useTransition } from 'react';

import { SecurityCard } from './security-card';

const channels = ['EMAIL', 'SMS'] as const;

type Channel = (typeof channels)[number];

interface ChannelCardLabels {
  readonly title: string;
  readonly text: string;
  readonly needsPhone: string;
  readonly options: Readonly<Record<Channel, string>>;
}

interface ChannelCardProps {
  /** Where the code of the second step of a sign-in goes now. */
  readonly channel: Channel;
  /** SMS can be chosen only with a confirmed phone number. */
  readonly phoneConfirmed: boolean;
  readonly labels: ChannelCardLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  /** Server action: saves the choice. */
  readonly choose: (channel: Channel) => Promise<ActionResult>;
}

/** Where the code of the second step of a sign-in goes: to the email or to the phone. */
export function ChannelCard({ channel, phoneConfirmed, labels, errors, choose }: ChannelCardProps) {
  // Shown at once. When the choice cannot be saved, it goes back to what the account has.
  const [chosen, setChosen] = useState(channel);
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();
  const error = errorCode ? (errors[errorCode] ?? errors.UNKNOWN) : undefined;

  return (
    <SecurityCard
      icon={<MessageSquareText />}
      title={labels.title}
      action={
        <Segmented
          size="md"
          role="radiogroup"
          label={labels.title}
          activeIndex={channels.indexOf(chosen)}
        >
          {channels.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === chosen}
              disabled={busy || (option === 'SMS' && !phoneConfirmed)}
              className={segmentedOptionClasses('md', option === chosen)}
              onClick={() => {
                if (option === chosen) {
                  return;
                }

                const before = chosen;

                setChosen(option);
                setErrorCode(undefined);
                startTransition(async () => {
                  const result = await choose(option);

                  if (!result.ok) {
                    setChosen(before);
                    setErrorCode(result.code);
                  }
                });
              }}
            >
              {labels.options[option]}
            </button>
          ))}
        </Segmented>
      }
    >
      {labels.text}
      {phoneConfirmed ? null : ` ${labels.needsPhone}`}
      {error ? <FormError>{error}</FormError> : null}
    </SecurityCard>
  );
}

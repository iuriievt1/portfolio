'use client';

import { Button } from '@bluberi/ui/components/button';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useState, useTransition } from 'react';

interface SecurityReminderLabels {
  readonly open: string;
  readonly title: string;
  readonly text: string;
  readonly continue: string;
  readonly later: string;
}

interface SecurityReminderProps {
  readonly labels: SecurityReminderLabels;
  /** The page with the security settings, and the name of its folder in the portal. */
  readonly settingsHref: Route;
  readonly settingsSegment: string;
  /** False when the person already chose "Later" in this session. */
  readonly open: boolean;
  /** Server action: puts the reminder off and opens the settings. */
  readonly onContinue: () => Promise<void>;
  /** Server action: puts the reminder off until the next sign-in. */
  readonly onLater: () => Promise<void>;
}

/**
 * Shown in the top bar until the account has a password and a confirmed phone:
 * a shield button that stays there, and under it a small card after every sign-in.
 */
export function SecurityReminder({
  labels,
  settingsHref,
  settingsSegment,
  open,
  onContinue,
  onLater,
}: SecurityReminderProps) {
  const onSettingsPage = useSelectedLayoutSegment() === settingsSegment;
  const [putOff, setPutOff] = useState(false);
  const [busy, startTransition] = useTransition();
  const closed = !open || putOff || onSettingsPage;

  return (
    <div className="relative flex-none">
      <Link
        href={settingsHref}
        aria-label={labels.open}
        title={labels.open}
        className="relative flex size-11 items-center justify-center rounded-sm bg-gray-100 text-berry-950 transition-colors outline-none hover:bg-gray-200 focus-visible:ring-4 focus-visible:ring-berry-500/14 [&_svg]:size-5"
      >
        <ShieldAlert />
        <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-white bg-pink-500" />
      </Link>
      <section
        aria-label={labels.title}
        data-closed={closed ? '' : undefined}
        className="absolute top-full right-0 z-20 mt-3 flex w-88 gap-3.5 rounded-lg border border-gray-200 bg-white p-5 shadow-lg transition-[opacity,translate,display] transition-discrete duration-200 ease-out data-closed:hidden data-closed:translate-y-1.5 data-closed:opacity-0 starting:translate-y-1.5 starting:opacity-0"
      >
        <span className="flex size-11 flex-none items-center justify-center rounded-sm bg-berry-100 text-berry-600 [&_svg]:size-5">
          <ShieldCheck />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold">{labels.title}</h2>
          <p className="mt-1 text-[13px] font-semibold text-gray-600">{labels.text}</p>
          <div className="mt-4 flex gap-2">
            <form action={onContinue}>
              <Button type="submit">{labels.continue}</Button>
            </form>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPutOff(true);
                startTransition(async () => {
                  try {
                    await onLater();
                  } catch {
                    // Nothing was put off: the card comes back.
                    setPutOff(false);
                  }
                });
              }}
            >
              {labels.later}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { Button } from '@bluberi/ui/components/button';
import Script from 'next/script';
import { useEffect, type ReactNode } from 'react';

import { scriptUrl, setMeasuring, setupScript } from '../consent/analytics';
import { decide, openCookieSettings, useConsent, useCookieSettingsOpen } from '../consent/consent';

export interface CookieConsentLabels {
  /** The name of the block for screen readers. */
  readonly label: string;
  /** What we ask for and why, with the link to the privacy policy. */
  readonly text: ReactNode;
  readonly accept: string;
  readonly decline: string;
}

interface CookieConsentProps {
  /** The Google Analytics property the visits are measured in. */
  readonly analyticsId: string;
  readonly labels: CookieConsentLabels;
}

/** On a phone the two buttons are taller, so a finger hits them. */
const touchSize = 'max-md:h-10';

/**
 * Asks a visitor whether the visits may be measured, and measures them only after a yes.
 * Until then Google Analytics is not loaded at all. The two buttons look the same, so neither
 * answer is pushed. The page stays usable behind the question, whatever the answer.
 */
export function CookieConsent({ analyticsId, labels }: CookieConsentProps) {
  const consent = useConsent();
  const settingsOpen = useCookieSettingsOpen();
  const known = consent !== undefined;
  const allowed = consent?.analytics === true;

  // A visitor who changes the choice later: the measuring follows it without a reload.
  useEffect(() => {
    if (known) {
      setMeasuring(analyticsId, allowed);
    }
  }, [analyticsId, allowed, known]);

  return (
    <>
      {allowed ? (
        <>
          <Script id="google-analytics-setup">{setupScript(analyticsId)}</Script>
          <Script src={scriptUrl(analyticsId)} />
        </>
      ) : null}
      {consent === null || settingsOpen ? (
        <section
          aria-label={labels.label}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 md:p-4"
        >
          {/* A slim bar: one row on a wide screen, the sentence above the buttons on a phone. */}
          <div className="pointer-events-auto flex w-full max-w-100 animate-step-in flex-col gap-2.5 rounded-xl border border-gray-200 bg-white p-3 shadow-lg md:w-auto md:max-w-none md:flex-row md:items-center md:gap-4 md:rounded-full md:py-1.5 md:pr-1.5 md:pl-5">
            <p className="text-[13px] leading-normal font-medium text-gray-700 max-md:px-1 md:whitespace-nowrap">
              {labels.text}
            </p>
            <div className="grid flex-none grid-cols-2 gap-1.5">
              <Button
                variant="dark"
                size="sm"
                pill
                className={touchSize}
                onClick={() => {
                  decide(false);
                }}
              >
                {labels.decline}
              </Button>
              <Button
                variant="dark"
                size="sm"
                pill
                className={touchSize}
                onClick={() => {
                  decide(true);
                }}
              >
                {labels.accept}
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

interface CookieSettingsButtonProps {
  readonly className: string;
  readonly children: ReactNode;
}

/** Shows the question about cookies again, so a visitor can change the answer as easily as they gave it. */
export function CookieSettingsButton({ className, children }: CookieSettingsButtonProps) {
  return (
    <button type="button" className={`cursor-pointer ${className}`} onClick={openCookieSettings}>
      {children}
    </button>
  );
}

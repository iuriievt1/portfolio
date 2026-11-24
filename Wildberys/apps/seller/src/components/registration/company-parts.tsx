'use client';

import { Checkbox } from '@bluberi/ui/components/checkbox';
import { useState, type ReactNode } from 'react';

import { useRegistrationDraft } from '../../registration/draft';

interface RegisterCardProps {
  readonly title: string;
  /** The register the card was read from, in a few letters: ARES, VIES. */
  readonly source: string;
  /** What the register says under the name, one line each. */
  readonly lines: readonly string[];
  /** A setting of the company, shown under a line across the card. */
  readonly children?: ReactNode;
}

/** What a public register says about a company, as one card the seller reads before going on. */
export function RegisterCard({ title, source, lines, children }: RegisterCardProps) {
  return (
    <div className="animate-step-in overflow-hidden rounded-md border border-gray-200">
      <div className="flex flex-col gap-1 px-4 py-3.5">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-base font-extrabold break-words">{title}</span>
          <span className="mt-0.5 flex-none rounded-[6px] bg-berry-100 px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-wider text-berry-600">
            {source}
          </span>
        </span>
        {lines.map((line) => (
          <span key={line} className="text-[13px] font-semibold break-words text-gray-600">
            {line}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

/** The line under a company: buyers will see who they buy from. */
export function PublicNote({ children }: { readonly children: ReactNode }) {
  return <p className="-mt-1.5 text-[12.5px] font-medium text-gray-600">{children}</p>;
}

interface TermsTickProps {
  /** The sentence about the terms for sellers, with its link. */
  readonly terms: ReactNode;
}

/**
 * The terms were ticked on the first step. A person who came to the company another way ticks them here,
 * and the box stays where it was ticked.
 */
export function TermsTick({ terms }: TermsTickProps) {
  const [draft, keep] = useRegistrationDraft();
  const [tickedHere, setTickedHere] = useState(false);

  if (draft.termsAccepted === true && !tickedHere) {
    return null;
  }

  return (
    <Checkbox
      label={<span className="text-[13px] leading-normal font-semibold">{terms}</span>}
      required
      checked={draft.termsAccepted === true}
      onChange={(event) => {
        setTickedHere(true);
        keep({ termsAccepted: event.target.checked });
      }}
    />
  );
}

'use client';

import type { SellerDocumentInfo, SellerDocumentKind } from '@bluberi/api-client';
import { FormError } from '@bluberi/ui/components/form-error';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DocumentUploads, type DocumentUploadsLabels } from '../document-uploads';
import { secondaryLink, StepFrame, SubmitButton } from './step-frame';

export interface DocumentsStepLabels extends DocumentUploadsLabels {
  readonly title: string;
  readonly text: string;
  readonly privateNote: string;
  readonly missing: string;
  readonly back: string;
  readonly continue: string;
}

interface DocumentsStepProps {
  /** The kinds of documents this registration is sent with. */
  readonly requiredKinds: readonly SellerDocumentKind[];
  readonly documents: readonly SellerDocumentInfo[];
  readonly locale: string;
  readonly labels: DocumentsStepLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly backHref: Route;
  readonly nextHref: Route;
  readonly add: (formData: FormData) => Promise<ActionResult>;
  readonly remove: (documentId: string) => Promise<ActionResult>;
}

/**
 * The second page of the company step: the documents the team checks the seller by.
 * Everybody shows who they are. A company from another country also shows its record in the register.
 */
export function DocumentsStep({
  requiredKinds,
  documents,
  locale,
  labels,
  errors,
  backHref,
  nextHref,
  add,
  remove,
}: DocumentsStepProps) {
  const router = useRouter();
  // The person pressed the main button while a document was still missing.
  const [askedTooEarly, setAskedTooEarly] = useState(false);
  const complete = requiredKinds.every((kind) =>
    documents.some((document) => document.kind === kind),
  );

  return (
    <StepFrame
      title={labels.title}
      text={labels.text}
      secondary={
        <Link href={backHref} className={secondaryLink}>
          <ArrowLeft />
          {labels.back}
        </Link>
      }
    >
      {/* Choosing a file answers the note about a missing document, so the note goes. */}
      <div
        onChangeCapture={() => {
          setAskedTooEarly(false);
        }}
      >
        <DocumentUploads
          kinds={requiredKinds}
          documents={documents}
          locale={locale}
          labels={labels}
          errors={errors}
          add={add}
          remove={remove}
        />
      </div>
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-gray-600 [&_svg]:size-4 [&_svg]:flex-none">
        <LockKeyhole />
        {labels.privateNote}
      </p>
      {askedTooEarly && !complete ? <FormError>{labels.missing}</FormError> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (complete) {
            router.push(nextHref);
          } else {
            setAskedTooEarly(true);
          }
        }}
      >
        <SubmitButton busy={false} icon={<ArrowRight />}>
          {labels.continue}
        </SubmitButton>
      </form>
    </StepFrame>
  );
}

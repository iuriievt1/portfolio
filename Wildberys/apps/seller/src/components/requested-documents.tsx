'use client';

import type { SellerDocumentInfo } from '@bluberi/api-client';
import { Button } from '@bluberi/ui/components/button';
import { FormError } from '@bluberi/ui/components/form-error';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { LoaderCircle, Send } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { documentKinds } from '../registration/documents';
import { DocumentUploads, type DocumentUploadsLabels } from './document-uploads';

export interface RequestedDocumentsLabels extends DocumentUploadsLabels {
  readonly messageLabel: string;
  readonly send: string;
}

interface RequestedDocumentsProps {
  /** What the team wrote: which documents it waits for. */
  readonly message: string;
  readonly documents: readonly SellerDocumentInfo[];
  readonly locale: string;
  readonly labels: RequestedDocumentsLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  /** Where the seller lands once the registration is sent back. */
  readonly doneHref: Route;
  readonly add: (formData: FormData) => Promise<ActionResult>;
  readonly remove: (documentId: string) => Promise<ActionResult>;
  /** Server action: sends the registration back to the team. */
  readonly resubmit: () => Promise<ActionResult>;
}

/**
 * The answer of a seller to a request of the team for documents: the message of the team,
 * the documents by kind, and the button that sends the registration back into the check.
 */
export function RequestedDocuments({
  message,
  documents,
  locale,
  labels,
  errors,
  doneHref,
  add,
  remove,
  resubmit,
}: RequestedDocumentsProps) {
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();

  return (
    <div className="mt-6 flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-white px-4 py-3.5">
        <span className="text-[13px] font-bold text-gray-700">{labels.messageLabel}</span>
        <p className="text-[15px] font-medium break-words whitespace-pre-line">{message}</p>
      </div>
      <div className="rounded-md border border-gray-200 bg-white px-4 py-4">
        <DocumentUploads
          kinds={documentKinds}
          documents={documents}
          locale={locale}
          labels={labels}
          errors={errors}
          add={add}
          remove={remove}
        />
      </div>
      {errorCode ? <FormError>{errors[errorCode] ?? errors.UNKNOWN ?? ''}</FormError> : null}
      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => {
          startTransition(async () => {
            const result = await resubmit();

            if (result.ok) {
              router.push(doneHref);
            } else {
              setErrorCode(result.code);
            }
          });
        }}
      >
        {labels.send}
        {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
      </Button>
    </div>
  );
}

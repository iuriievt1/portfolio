'use client';

import type { SellerDocumentInfo, SellerDocumentKind } from '@bluberi/api-client';
import { buttonClasses } from '@bluberi/ui/components/button';
import { FormError } from '@bluberi/ui/components/form-error';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { FileText, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { useState, useTransition } from 'react';

import { documentFormats, documentMaxBytes, fileSize } from '../registration/documents';

export interface DocumentUploadsLabels {
  readonly kinds: Readonly<
    Record<SellerDocumentKind, { readonly title: string; readonly hint: string }>
  >;
  readonly upload: string;
  readonly remove: string;
}

interface DocumentUploadsProps {
  /** The kinds of documents asked for here, in the order they are shown. */
  readonly kinds: readonly SellerDocumentKind[];
  /** The documents the seller gave so far. */
  readonly documents: readonly SellerDocumentInfo[];
  /** The language of the page: sizes of files are written in it. */
  readonly locale: string;
  readonly labels: DocumentUploadsLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  /** Server actions: add a document, delete one. */
  readonly add: (formData: FormData) => Promise<ActionResult>;
  readonly remove: (documentId: string) => Promise<ActionResult>;
}

/**
 * The documents of a seller by kind: what is uploaded, with a way to delete it, and a button
 * that uploads one more file. A file goes to Bluberi the moment it is chosen.
 */
export function DocumentUploads({
  kinds,
  documents,
  locale,
  labels,
  errors,
  add,
  remove,
}: DocumentUploadsProps) {
  // The kind a file is being uploaded for, or the document that is being deleted.
  const [working, setWorking] = useState<string>();
  const [failure, setFailure] = useState<{ readonly kind: string; readonly code: string }>();
  const [busy, startTransition] = useTransition();

  function run(kind: SellerDocumentKind, mark: string, action: () => Promise<ActionResult>): void {
    setWorking(mark);
    setFailure(undefined);
    startTransition(async () => {
      const result = await action();

      setWorking(undefined);
      setFailure(result.ok ? undefined : { kind, code: result.code });
    });
  }

  function upload(kind: SellerDocumentKind, file: File): void {
    if (file.size > documentMaxBytes) {
      setFailure({ kind, code: 'DOCUMENT_TOO_LARGE' });

      return;
    }

    const form = new FormData();

    form.set('file', file);
    form.set('kind', kind);
    run(kind, kind, () => add(form));
  }

  return (
    <div className="flex flex-col gap-5">
      {kinds.map((kind) => {
        const error = failure?.kind === kind ? (errors[failure.code] ?? errors.UNKNOWN) : undefined;

        return (
          <section key={kind} className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[15px] font-extrabold">{labels.kinds[kind].title}</h2>
              <p className="text-[13px] font-medium text-gray-600">{labels.kinds[kind].hint}</p>
            </div>
            {documents
              .filter((document) => document.kind === kind)
              .map((document) => (
                <div
                  key={document.id}
                  className="flex min-h-12 items-center gap-3 rounded-sm bg-gray-50 py-1.5 pr-1.5 pl-3.5"
                >
                  <FileText className="size-4.5 flex-none text-berry-500" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {document.fileName}
                  </span>
                  <span className="flex-none text-[13px] font-semibold text-gray-600">
                    {fileSize(document.sizeBytes, locale)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${labels.remove}: ${document.fileName}`}
                    title={labels.remove}
                    disabled={busy}
                    className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-xs text-gray-500 transition-colors outline-none hover:bg-gray-200 hover:text-berry-950 focus-visible:ring-4 focus-visible:ring-berry-500/14 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4.5"
                    onClick={() => {
                      run(kind, document.id, () => remove(document.id));
                    }}
                  >
                    {working === document.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </button>
                </div>
              ))}
            <label
              className={`${buttonClasses({ variant: 'soft', size: 'lg' })} w-full cursor-pointer has-focus-visible:ring-4 has-focus-visible:ring-berry-500/14 ${
                busy ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <input
                type="file"
                accept={documentFormats}
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const [file] = event.target.files ?? [];

                  // The same file can be chosen again after a failure.
                  event.target.value = '';

                  if (file) {
                    upload(kind, file);
                  }
                }}
              />
              {labels.upload}
              {working === kind ? <LoaderCircle className="animate-spin" /> : <Upload />}
            </label>
            {error ? <FormError>{error}</FormError> : null}
          </section>
        );
      })}
    </div>
  );
}

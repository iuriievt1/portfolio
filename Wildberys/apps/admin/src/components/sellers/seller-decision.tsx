'use client';

import type { SellerStatus } from '@bluberi/api-client';
import { Button } from '@bluberi/ui/components/button';
import { Dialog } from '@bluberi/ui/components/dialog';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { TextArea } from '@bluberi/ui/components/text-area';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { LoaderCircle } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useState, useTransition } from 'react';

import { decisionMessageMaxLength, decisionMessageMinLength } from '../../sellers/decision-message';
import { CardNote, CardSection } from '../card-section';

/** A decision that goes to the seller with a message. */
type MessageDecision = 'requestDocuments' | 'reject';

/** What the block can ask the API for. The one that runs shows on its button. */
type Operation = MessageDecision | 'approve' | 'reopen' | 'removeDraft';

export interface SellerDecisionLabels {
  readonly title: string;
  readonly approve: string;
  readonly requestDocuments: string;
  readonly reject: string;
  readonly reopen: string;
  readonly documentsRequestedNote: string;
  readonly rejectedNote: string;
  readonly messageLabel: string;
  readonly messageHint: string;
  readonly cancel: string;
  readonly draftTitle: string;
  readonly draftNote: string;
  readonly removeDraft: string;
  readonly removeDraftTitle: string;
  readonly removeDraftText: string;
  readonly removeDraftConfirm: string;
  readonly close: string;
}

interface SellerDecisionProps {
  readonly sellerId: string;
  readonly status: SellerStatus;
  readonly labels: SellerDecisionLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  /** Where to go after a draft is deleted: its card is gone. */
  readonly afterRemovalHref: Route;
  /** Server actions: the decisions and the deleting of a draft. */
  readonly approve: (sellerId: string) => Promise<ActionResult>;
  readonly requestDocuments: (sellerId: string, message: string) => Promise<ActionResult>;
  readonly reject: (sellerId: string, message: string) => Promise<ActionResult>;
  readonly reopen: (sellerId: string) => Promise<ActionResult>;
  readonly removeDraft: (sellerId: string) => Promise<ActionResult>;
}

/**
 * What a person with full access can do with a seller, by the status the seller is in: decide about
 * a seller in the check, refuse one the team waits for documents from, take a refusal back,
 * delete a registration nobody sent. Nothing is offered for an approved seller.
 */
export function SellerDecision({
  sellerId,
  status,
  labels,
  errors,
  afterRemovalHref,
  approve,
  requestDocuments,
  reject,
  reopen,
  removeDraft,
}: SellerDecisionProps) {
  const router = useRouter();
  const [writing, setWriting] = useState<MessageDecision>();
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [running, setRunning] = useState<Operation>();
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();
  const error = errorCode ? (errors[errorCode] ?? errors.UNKNOWN) : undefined;

  // Next.js keeps a page it has shown. A message being written is there on the way back.
  // An open dialog and an old error are not.
  useLayoutEffect(
    () => () => {
      setConfirmingRemoval(false);
      setErrorCode(undefined);
    },
    [],
  );

  /** One request at a time. After a decision the server draws the card again, in its new status. */
  function run(
    operation: Operation,
    send: () => Promise<ActionResult>,
    afterwards?: () => void,
  ): void {
    setErrorCode(undefined);
    setRunning(operation);
    startTransition(async () => {
      const result = await send();

      if (result.ok) {
        afterwards?.();
      } else {
        setErrorCode(result.code);
      }
    });
  }

  function spinner(operation: Operation) {
    return busy && running === operation ? <LoaderCircle className="animate-spin" /> : null;
  }

  if (status === 'APPROVED' || status === 'SUSPENDED') {
    return null;
  }

  if (status === 'DRAFT') {
    return (
      <CardSection title={labels.draftTitle}>
        <CardNote>{labels.draftNote}</CardNote>
        {/* The dialog can be closed while the API answers. What went wrong is then said here. */}
        {error && !confirmingRemoval ? <FormError>{error}</FormError> : null}
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => {
            setErrorCode(undefined);
            setConfirmingRemoval(true);
          }}
        >
          {labels.removeDraft}
        </Button>
        <Dialog
          open={confirmingRemoval}
          onClose={() => {
            setConfirmingRemoval(false);
          }}
          title={labels.removeDraftTitle}
          closeLabel={labels.close}
        >
          <p className="mt-2 text-sm font-medium text-gray-600">{labels.removeDraftText}</p>
          {error ? <FormError>{error}</FormError> : null}
          {/* The way out comes first, so the dialog opens with the focus on it and not on the deleting. */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirmingRemoval(false);
              }}
            >
              {labels.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                run(
                  'removeDraft',
                  () => removeDraft(sellerId),
                  // The card is gone, so the list takes its place in the history of the browser.
                  () => {
                    router.replace(afterRemovalHref);
                  },
                );
              }}
            >
              {labels.removeDraftConfirm}
              {spinner('removeDraft')}
            </Button>
          </div>
        </Dialog>
      </CardSection>
    );
  }

  return (
    <CardSection title={labels.title}>
      <div className="flex flex-col gap-4">
        {status === 'DOCUMENTS_REQUESTED' ? (
          <CardNote>{labels.documentsRequestedNote}</CardNote>
        ) : null}
        {status === 'REJECTED' ? <CardNote>{labels.rejectedNote}</CardNote> : null}
        {writing ? (
          <Form
            className="flex flex-col gap-4"
            onChange={() => {
              setErrorCode(undefined);
            }}
            onFields={(fields) => {
              const message = fields.get('message');
              const send = writing === 'reject' ? reject : requestDocuments;

              run(writing, () => send(sellerId, typeof message === 'string' ? message : ''));
            }}
          >
            <TextArea
              label={labels.messageLabel}
              hint={labels.messageHint}
              name="message"
              rows={5}
              required
              minLength={decisionMessageMinLength}
              maxLength={decisionMessageMaxLength}
              autoFocus
            />
            {error ? <FormError>{error}</FormError> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant={writing === 'reject' ? 'danger' : 'primary'}
                disabled={busy}
              >
                {labels[writing]}
                {spinner(writing)}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setErrorCode(undefined);
                  setWriting(undefined);
                }}
              >
                {labels.cancel}
              </Button>
            </div>
          </Form>
        ) : (
          <>
            {error ? <FormError>{error}</FormError> : null}
            <div className="flex flex-wrap gap-2">
              {status === 'PENDING_REVIEW' ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      run('approve', () => approve(sellerId));
                    }}
                  >
                    {labels.approve}
                    {spinner('approve')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setErrorCode(undefined);
                      setWriting('requestDocuments');
                    }}
                  >
                    {labels.requestDocuments}
                  </Button>
                </>
              ) : null}
              {status === 'REJECTED' ? (
                <Button
                  variant="soft"
                  disabled={busy}
                  onClick={() => {
                    run('reopen', () => reopen(sellerId));
                  }}
                >
                  {labels.reopen}
                  {spinner('reopen')}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    setErrorCode(undefined);
                    setWriting('reject');
                  }}
                >
                  {labels.reject}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </CardSection>
  );
}

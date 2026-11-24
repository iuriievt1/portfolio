import type {
  Currency,
  PayoutMethod,
  PlatformRole,
  SellerDocumentKind,
  SignInConfirmationChannel,
  SignInMethod,
} from '../generated/prisma/enums.js';

/**
 * Every action the audit log knows. A new action is added here first.
 * An action is never removed or renamed: old entries keep using it.
 */
export const auditActions = [
  'auth.signed_in',
  'auth.signed_out_everywhere',
  'auth.password_changed',
  'auth.phone_confirmed',
  'auth.sign_in_confirmation_channel_changed',
  'team.role_granted',
  'team.role_revoked',
  'seller.staff_added',
  'seller.staff_removed',
  'seller.registration_started',
  'seller.registration_submitted',
  'seller.payout_method_chosen',
  'seller.bank_account_saved',
  'seller.document_added',
  'seller.document_removed',
  'seller.document_opened',
  'seller.approved',
  'seller.documents_requested',
  'seller.rejected',
  'seller.review_reopened',
  'seller.draft_removed',
] as const;

export type AuditAction = (typeof auditActions)[number];

/** What an action was done to: a user or a seller. Other kinds of records come with their features. */
interface UserTarget {
  readonly type: 'user';
  readonly id: string;
}

interface SellerTarget {
  readonly type: 'seller';
  readonly id: string;
}

/**
 * What is written for each action: who did it, what it was done to and the facts about it.
 * An entry that does not fit its action does not compile.
 */
export type AuditEvent =
  /** Written only for members of the Bluberi team. */
  | {
      readonly action: 'auth.signed_in';
      readonly actorId: string;
      readonly details: { readonly method: SignInMethod };
    }
  | {
      readonly action:
        'auth.signed_out_everywhere' | 'auth.password_changed' | 'auth.phone_confirmed';
      readonly actorId: string;
    }
  | {
      readonly action: 'auth.sign_in_confirmation_channel_changed';
      readonly actorId: string;
      readonly details: { readonly channel: SignInConfirmationChannel };
    }
  | {
      readonly action: 'team.role_granted';
      /** Null when the role was given from the command line. */
      readonly actorId: string | null;
      readonly target: UserTarget;
      readonly details: { readonly role: PlatformRole };
    }
  | {
      readonly action: 'team.role_revoked';
      readonly actorId: string;
      readonly target: UserTarget;
      readonly details: { readonly role: PlatformRole };
    }
  | {
      readonly action: 'seller.staff_added' | 'seller.staff_removed';
      readonly actorId: string;
      readonly target: UserTarget;
      readonly details: { readonly sellerId: string };
    }
  /** A person started to register a company as a seller, or took another company for it. */
  | {
      readonly action: 'seller.registration_started';
      readonly actorId: string;
      readonly target: SellerTarget;
      readonly details: { readonly countryCode: string; readonly registrationNumber: string };
    }
  /** The owner sent the finished registration to Bluberi for a check. */
  | {
      readonly action: 'seller.registration_submitted';
      readonly actorId: string;
      readonly target: SellerTarget;
    }
  | {
      readonly action: 'seller.payout_method_chosen';
      readonly actorId: string;
      readonly target: SellerTarget;
      readonly details: { readonly method: PayoutMethod };
    }
  /** Only what tells the account from another one is written: the whole number is never kept. */
  | {
      readonly action: 'seller.bank_account_saved';
      readonly actorId: string;
      readonly target: SellerTarget;
      readonly details: {
        readonly country: string;
        readonly last4: string;
        readonly currency: Currency;
      };
    }
  /** A document of a seller was uploaded, deleted, or opened by a member of the team. */
  | {
      readonly action:
        'seller.document_added' | 'seller.document_removed' | 'seller.document_opened';
      readonly actorId: string;
      readonly target: SellerTarget;
      readonly details: { readonly documentId: string; readonly kind: SellerDocumentKind };
    }
  /** The team let the seller sell, or took a refused seller back into the check. */
  | {
      readonly action: 'seller.approved' | 'seller.review_reopened';
      readonly actorId: string;
      readonly target: SellerTarget;
    }
  /** The team asked the seller for documents, or refused the seller. The message is what the seller was told. */
  | {
      readonly action: 'seller.documents_requested' | 'seller.rejected';
      readonly actorId: string;
      readonly target: SellerTarget;
      readonly details: { readonly message: string };
    }
  /** The team deleted a registration nobody sent. What says which company it was stays here. */
  | {
      readonly action: 'seller.draft_removed';
      readonly actorId: string;
      readonly target: SellerTarget;
      readonly details: {
        readonly countryCode: string;
        readonly registrationNumber: string;
        readonly legalName: string;
      };
    };

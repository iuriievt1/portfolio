import type { Observable } from 'rxjs';

/** A conversation of a seller got a message, or one side read it. */
export interface ConversationChanged {
  readonly kind: 'conversation-changed';
  readonly sellerId: string;
  readonly conversationId: string;
}

/**
 * Something about a seller changed: a step of the registration, a document, the payout account,
 * the status. A registration that was sent or deleted, and a decision of the team, are among them.
 */
export interface SellerChanged {
  readonly kind: 'seller-changed';
  readonly sellerId: string;
}

/** Somebody signed up for the news by email, or left. */
export interface NewsletterChanged {
  readonly kind: 'newsletter-changed';
}

/** What a module reports. */
export type Change = ConversationChanged | SellerChanged | NewsletterChanged;

/** The copies of the API could not hear each other for a while: something may have changed unheard. */
export interface EventsMissed {
  readonly kind: 'events-missed';
}

export type LiveEvent = Change | EventsMissed;

/**
 * Tells open pages that something changed, the moment it is saved. An event names what changed and
 * never carries the content: a page that hears it reads the content again, with the rights of its person.
 * Every running copy of the API hears what any copy reports.
 *
 * What a person sees on a page and somebody else can change is reported here, so the page shows it at once.
 * Who hears which change is written in one place: audience.ts.
 */
export abstract class LiveEvents {
  /**
   * Reports a change that is already saved. It never fails the change:
   * a report that cannot be sent is written to the log, and pages show the change when they are read again.
   */
  abstract report(change: Change): Promise<void>;

  /** What the copies of the API report, this one included. It ends when the API stops. */
  abstract readonly events: Observable<LiveEvent>;
}

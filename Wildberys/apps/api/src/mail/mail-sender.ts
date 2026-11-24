export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** Sends emails. The rest of the API depends on this class, not on a mail library. */
export abstract class MailSender {
  abstract send(message: EmailMessage): Promise<void>;
}

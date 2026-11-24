export interface SmsMessage {
  /** Phone number in the international format, for example +420777123456. */
  readonly to: string;
  readonly text: string;
}

/** Sends text messages. The rest of the API depends on this class, not on an SMS provider. */
export abstract class SmsSender {
  abstract send(message: SmsMessage): Promise<void>;
}

import type { SellerRegisterCheck } from './seller-moderation.dto.js';

/** How long an answer of the public registers about a seller is kept. */
export const registerCheckLifetimeMilliseconds = 5 * 60_000;

interface Remembered {
  /** When the seller was last changed. A seller that changed since is asked about again. */
  readonly sellerVersion: number;
  readonly until: number;
  readonly check: SellerRegisterCheck;
}

/**
 * What the public registers said about the sellers the team looked at in the last minutes.
 * An open card reads itself again whenever something changes in the admin, and the registers
 * should not be asked every time: they are asked when a card is opened, and then at most once
 * in five minutes, or when the seller changes.
 */
export class RegisterCheckMemory {
  private readonly answers = new Map<string, Remembered>();

  find(sellerId: string, sellerVersion: number, now = Date.now()): SellerRegisterCheck | undefined {
    const known = this.answers.get(sellerId);

    return known?.sellerVersion === sellerVersion && known.until > now ? known.check : undefined;
  }

  keep(
    sellerId: string,
    sellerVersion: number,
    check: SellerRegisterCheck,
    now = Date.now(),
  ): void {
    // Answers that are too old leave, so the memory holds only the cards of the last minutes.
    for (const [id, { until }] of this.answers) {
      if (until <= now) {
        this.answers.delete(id);
      }
    }

    this.answers.set(sellerId, {
      sellerVersion,
      until: now + registerCheckLifetimeMilliseconds,
      check,
    });
  }
}

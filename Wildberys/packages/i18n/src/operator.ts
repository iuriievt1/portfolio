/**
 * The company that runs Bluberi, the way the legal texts name it.
 * The values are placeholders until the company is registered and has its mailbox:
 * they have to be replaced before anything goes public, see docs/backlog.md.
 */
export const operator = {
  name: 'Bluberi s.r.o.',
  /** IČO, the registration number of a Czech company. */
  registrationNumber: '00000000',
  /** The registered office. */
  address: 'Ulice 0, 110 00 Praha 1',
  /** Where people write about their personal data. */
  privacyEmail: 'support@bluberi.cz',
  /** Where a seller writes to the team, for example to object to a decision about the registration. */
  supportEmail: 'support@bluberi.cz',
} as const;

import type { ConversationRow, MessagePreview } from '@bluberi/api-client';
import type { createFormatter } from 'next-intl';

type Formatter = ReturnType<typeof createFormatter>;

/** The subject of a conversation. The one about the registration has none of its own: the portal names it. */
export function subjectOf(
  { topic, subject }: Pick<ConversationRow, 'topic' | 'subject'>,
  registration: string,
): string {
  return topic === 'REGISTRATION' ? registration : subject;
}

interface PreviewLabels {
  /** In front of what the seller wrote last. */
  readonly you: string;
  readonly decisions: Readonly<Record<Exclude<MessagePreview['kind'], 'TEXT'>, string>>;
}

/** The line of a conversation in the list: the name of a decision, or the start of the last text. */
export function previewOf({ side, kind, body }: MessagePreview, labels: PreviewLabels): string {
  if (kind !== 'TEXT') {
    return body ? `${labels.decisions[kind]}: ${body}` : labels.decisions[kind];
  }

  return side === 'SELLER' ? `${labels.you}: ${body}` : body;
}

const day = 24 * 60 * 60 * 1000;

/** When something was written, as short as a list needs it: the time today, the day this week, then the date. */
export function timeOf(format: Formatter, time: Date, now: Date): string {
  const age = now.getTime() - time.getTime();

  if (age < day && time.getDate() === now.getDate()) {
    return format.dateTime(time, { hour: 'numeric', minute: '2-digit' });
  }

  return age < 6 * day
    ? format.dateTime(time, { weekday: 'short' })
    : format.dateTime(time, { day: 'numeric', month: 'numeric' });
}

import type { ReactNode } from 'react';

interface CardSectionProps {
  readonly title: string;
  /** Shown at the end of the line of the title, for example the result of a check. */
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}

/** One block of a card of the admin: a title and what belongs under it. */
export function CardSection({ title, aside, children }: CardSectionProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-lg font-extrabold tracking-[-0.01em]">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

interface CardNoteProps {
  /** The note says that something could not be read. Screen readers read it out when it appears. */
  readonly failed?: boolean;
  readonly children: ReactNode;
}

/** A quiet line of a card: there is nothing to show, a remark to what is shown, or what went wrong. */
export function CardNote({ failed = false, children }: CardNoteProps) {
  return (
    <p
      role={failed ? 'alert' : undefined}
      className={`text-sm font-semibold ${failed ? 'text-red-500' : 'text-gray-600'}`}
    >
      {children}
    </p>
  );
}

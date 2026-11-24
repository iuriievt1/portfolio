import type { ReactNode } from 'react';

import { belowHeader, container, sectionTitle } from './layout';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

interface TextPageProps {
  readonly title: string;
  /** A short line under the title, for example the date a document takes effect. */
  readonly note?: string;
  readonly children: ReactNode;
}

/** A page that is read: a legal text or a small form, in a column that is easy on the eyes. */
export function TextPage({ title, note, children }: TextPageProps) {
  return (
    // A short page still fills the screen, so the footer stays at the bottom.
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className={`flex-1 pt-5 pb-14 lg:pt-9 lg:pb-24 ${container}`}>
        <article className="max-w-190">
          <h1 className={sectionTitle}>{title}</h1>
          {note ? <p className="mt-2.5 text-sm font-semibold text-gray-600">{note}</p> : null}
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

const text = 'text-base leading-[1.65] font-medium text-gray-700';

interface TextSectionProps {
  readonly title: string;
  /** The name of the part in the address of the page, for a link that leads straight to it. */
  readonly id?: string;
  readonly children: ReactNode;
}

/** A part of a text with its own title. */
export function TextSection({ title, id, children }: TextSectionProps) {
  return (
    <section id={id} className={`mt-9 lg:mt-11 ${belowHeader}`}>
      <h2 className="text-xl font-bold tracking-[-0.02em] lg:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function Paragraph({ children }: { readonly children: ReactNode }) {
  return <p className={`mt-3 ${text}`}>{children}</p>;
}

/** A list with dots. Each child is one item. */
export function BulletList({ children }: { readonly children: ReactNode }) {
  return (
    <ul className={`mt-3 flex list-disc flex-col gap-1.5 pl-5 marker:text-berry-300 ${text}`}>
      {children}
    </ul>
  );
}

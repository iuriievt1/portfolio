import type { ReactNode } from 'react';

import { pageFadeTransition } from './page-fade';
import { Segmented, segmentedOptionClasses } from './segmented';

export interface Language<Locale extends string> {
  readonly locale: Locale;
  /** The language under its own name: Čeština, English. */
  readonly name: string;
  /** Two letters for the switch: CZ, EN. */
  readonly shortName: string;
}

/** What the link to a language gets. The app puts it on the link of its own navigation. */
export interface LanguageLinkProps {
  readonly lang: string;
  readonly title: string;
  readonly 'aria-label': string;
  readonly 'aria-current': 'true' | undefined;
  readonly className: string;
  readonly replace: true;
  readonly scroll: false;
  readonly transitionTypes: string[];
  readonly children: string;
}

interface LanguageSwitchProps<Locale extends string> {
  /** What the switch is, for screen readers. */
  readonly label: string;
  readonly languages: readonly Language<Locale>[];
  /** The language of the page. */
  readonly current: string;
  /** Draws the link that changes the language and stays on the same page. */
  readonly link: (language: Language<Locale>, props: LanguageLinkProps) => ReactNode;
}

/**
 * The compact language switch: two letters per language and a thumb that slides.
 * The page is not loaded anew: its texts fade into the other language.
 */
export function LanguageSwitch<Locale extends string>({
  label,
  languages,
  current,
  link,
}: LanguageSwitchProps<Locale>) {
  return (
    <nav aria-label={label}>
      <Segmented
        size="sm"
        activeIndex={languages.findIndex((language) => language.locale === current)}
        transitionName="language-switch-thumb"
      >
        {languages.map((language) =>
          link(language, {
            lang: language.locale,
            title: language.name,
            'aria-label': language.name,
            'aria-current': language.locale === current ? 'true' : undefined,
            className: segmentedOptionClasses('sm', language.locale === current),
            replace: true,
            scroll: false,
            transitionTypes: [pageFadeTransition],
            children: language.shortName,
          }),
        )}
      </Segmented>
    </nav>
  );
}

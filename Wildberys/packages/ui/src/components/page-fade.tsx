import { ViewTransition, type ReactNode } from 'react';

/**
 * A navigation marked with this type fades the old page into the new one:
 * pass it as a transition type to a link or to the router.
 */
export const pageFadeTransition = 'page-fade';

const onPageFade = { [pageFadeTransition]: 'auto', default: 'none' };

/**
 * Wraps the pages of an app in its root layout. Pages then change with a fade where
 * the navigation asks for it, and at once everywhere else.
 */
export function PageFade({ children }: { readonly children: ReactNode }) {
  return (
    // "share" is for a page that is drawn anew, like after a change of language. "update" is for the rest.
    <ViewTransition name="page" share={onPageFade} update={onPageFade} default="none">
      {children}
    </ViewTransition>
  );
}

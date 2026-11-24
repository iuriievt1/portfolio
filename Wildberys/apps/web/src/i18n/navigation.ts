import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Links that know the language. A link to another language also remembers the choice,
 * which a plain link from one page to another does not do.
 */
export const { Link, usePathname, getPathname } = createNavigation(routing);

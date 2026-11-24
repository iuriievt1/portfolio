import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Links that know the language, for client components. A link to another language
 * also remembers the choice, which a plain link from one page to another does not do.
 * The proxy, server actions and route handlers cannot use these: they have the helpers in paths.ts.
 */
export const { Link, usePathname } = createNavigation(routing);

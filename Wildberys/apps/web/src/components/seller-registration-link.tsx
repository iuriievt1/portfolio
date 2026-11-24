import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';

import { getPathname } from '../i18n/navigation';
import { sellerRegistrationPath } from '../paths';

interface SellerRegistrationLinkProps {
  readonly className: string;
  readonly children: ReactNode;
}

/** The way to the registration of a seller. A plain link: it leaves the store for the seller portal. */
export function SellerRegistrationLink({ className, children }: SellerRegistrationLinkProps) {
  const locale = useLocale();

  return (
    <a href={getPathname({ href: sellerRegistrationPath, locale })} className={className}>
      {children}
    </a>
  );
}

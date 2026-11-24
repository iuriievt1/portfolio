import { CloudArrowUpIcon, GiftIcon, MegaphoneIcon, WalletIcon } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { iconTile } from './layout';

const benefits: readonly {
  key: 'free' | 'payouts' | 'promotion' | 'import';
  icon: ReactNode;
}[] = [
  { key: 'free', icon: <GiftIcon weight="duotone" /> },
  { key: 'payouts', icon: <WalletIcon weight="duotone" /> },
  { key: 'promotion', icon: <MegaphoneIcon weight="duotone" /> },
  { key: 'import', icon: <CloudArrowUpIcon weight="duotone" /> },
];

interface SellerBenefitsProps {
  /** Where the list stands and in how many columns. */
  readonly className: string;
}

/** What Bluberi gives a seller, one line each: what it costs, when the money comes and the help at the start. */
export function SellerBenefits({ className }: SellerBenefitsProps) {
  const t = useTranslations('landing.sellers.benefits');

  return (
    <ul className={`grid gap-2.5 xl:gap-3 ${className}`}>
      {benefits.map(({ key, icon }) => (
        <li
          key={key}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3.5 text-[15px] leading-[1.3] font-bold"
        >
          <span className={`size-10.5 [&_svg]:size-5.5 ${iconTile.light}`}>{icon}</span>
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

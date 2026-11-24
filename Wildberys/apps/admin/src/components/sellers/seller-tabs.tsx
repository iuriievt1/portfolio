import type { SellerCounts } from '@bluberi/api-client';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { sellerTabPath, sellerTabs, type SellerTab } from '../../sellers/paths';

interface SellerTabsProps {
  /** The tab that is open. */
  readonly active: SellerTab;
  /** How many sellers each tab holds. Without an answer of the API the tabs show no numbers. */
  readonly counts: SellerCounts | undefined;
}

/** The tabs of the list of sellers: a link for a status, with the number of its sellers. */
export async function SellerTabs({ active, counts }: SellerTabsProps) {
  const t = await getTranslations('sellers.list');
  const format = await getFormatter();

  return (
    // The line under the tabs. The mark of the open tab lies on it.
    <div className="border-b border-gray-200">
      {/* Tabs that do not fit a narrow screen scroll sideways inside their row. */}
      <nav
        aria-label={t('tabsLabel')}
        className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {sellerTabs.map((tab) => {
          const open = tab === active;

          return (
            <Link
              key={tab}
              href={sellerTabPath(tab)}
              aria-current={open ? 'page' : undefined}
              className={`flex flex-none items-center gap-1.5 rounded-t-xs border-b-[2.5px] px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-berry-500/14 focus-visible:ring-inset ${
                open
                  ? 'border-berry-500 text-berry-600'
                  : 'border-transparent text-gray-600 hover:text-berry-950'
              }`}
            >
              {t(`tabs.${tab}`)}
              {counts ? (
                <span
                  className={`rounded-full px-1.75 py-px text-[11.5px] tabular-nums ${
                    open ? 'bg-berry-100 text-berry-600' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {format.number(counts[tab])}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

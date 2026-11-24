import { GooglePlayLogoIcon } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';

import { appStoreUrl, googlePlayUrl } from '../paths';
import { AppleLogo } from './apple-logo';

const stores = [
  { key: 'appStore', href: appStoreUrl, icon: <AppleLogo /> },
  { key: 'googlePlay', href: googlePlayUrl, icon: <GooglePlayLogoIcon weight="fill" /> },
] as const;

/** On a light or coloured background the buttons are dark, on the dark footer they are lighter than it. */
const tones = {
  dark: 'bg-berry-950 hover:bg-berry-800',
  onDark: 'bg-white/10 hover:bg-white/16',
} as const;

interface StoreButtonsProps {
  readonly tone?: keyof typeof tones;
  /** Where the pair stands and how wide it may be. */
  readonly className?: string;
}

/**
 * The two buttons that open the App Store and Google Play. They are the same size and say
 * the same thing in the language of the page. In a narrow place they are drawn smaller,
 * and where even that does not fit they stand one under the other.
 */
export function StoreButtons({ tone = 'dark', className = '' }: StoreButtonsProps) {
  const t = useTranslations('site.stores');

  return (
    <div className={`@container w-full ${className}`}>
      <div className="grid gap-2 @[17.5rem]:grid-cols-2 @[20.5rem]:gap-2.5">
        {stores.map(({ key, href, icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-12 items-center justify-center gap-2 rounded-sm px-2.5 text-white ring-1 ring-white/14 transition outline-none ring-inset focus-visible:ring-4 focus-visible:ring-berry-300 active:scale-[0.97] @[20.5rem]:h-12.5 @[20.5rem]:gap-2.5 [&_svg]:size-6 [&_svg]:flex-none @[20.5rem]:[&_svg]:size-6.5 ${tones[tone]}`}
          >
            {icon}
            <span className="flex flex-col gap-1">
              <span className="text-[10px] leading-none font-medium whitespace-nowrap text-white/70 @[20.5rem]:text-[10.5px]">
                {t(`${key}.line`)}
              </span>
              <span className="text-[15px] leading-none font-semibold tracking-[-0.01em] whitespace-nowrap @[20.5rem]:text-base">
                {t(`${key}.name`)}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

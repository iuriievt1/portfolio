import Image from 'next/image';

import berryWhite from '../assets/berry-white.svg';
import berry from '../assets/berry.svg';

interface LogoProps {
  /** Color of the word. White is for dark and colored backgrounds. */
  readonly tone?: 'dark' | 'white';
  /** The berry in color, or in white for colored backgrounds. */
  readonly mark?: 'color' | 'white';
  /** The size comes from the font size of the place the logo is in. */
  readonly className?: string;
}

/** Logo format 1: the berry and the word bluberi. */
export function Logo({ tone = 'dark', mark = 'color', className = '' }: LogoProps) {
  const color = tone === 'white' ? 'text-white' : 'text-berry-950';

  return (
    <span
      className={`inline-flex items-center gap-[0.14em] leading-none font-extrabold tracking-[-0.045em] ${color} ${className}`}
    >
      <Image
        src={mark === 'white' ? berryWhite : berry}
        alt=""
        className="h-[1.18em] w-auto -translate-y-[0.06em]"
      />
      bluberi
    </span>
  );
}

/** The width of a page and the space at its sides: 1440 with 80 at each side in design 01, less on smaller screens. */
export const container = 'mx-auto w-full max-w-360 px-5 sm:px-8 lg:px-10 xl:px-16 2xl:px-20';

/** The title of a block or of a page. */
export const sectionTitle =
  'text-[26px] leading-[1.15] font-bold tracking-[-0.025em] text-balance sm:text-[30px] lg:text-[38px]';

/** The sentence under a title that says what the block is about. */
export const lead = 'text-base leading-[1.6] font-medium text-balance text-gray-600 lg:text-[17px]';

/** The square behind an icon, on a light background and on a dark or coloured one. */
export const iconTile = {
  light: 'flex flex-none items-center justify-center rounded-sm bg-berry-50 text-berry-600',
  dark: 'flex flex-none items-center justify-center rounded-sm bg-white/14 text-white',
} as const;

/** How far below the top a block stops when a link scrolls to it: under the header, which stays on the screen. */
export const belowHeader = 'scroll-mt-20 lg:scroll-mt-26';

/** A link inside a text. */
export const textLink =
  'rounded-xs font-bold text-berry-600 underline decoration-berry-300 underline-offset-2 transition-colors outline-none hover:text-berry-700 hover:decoration-berry-500 focus-visible:ring-4 focus-visible:ring-berry-500/14';

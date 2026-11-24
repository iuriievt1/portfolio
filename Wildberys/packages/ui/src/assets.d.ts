// Lets the components import the logo files. Next.js turns an imported image into its address and size.
declare module '*.svg' {
  import type { StaticImageData } from 'next/image';

  const image: StaticImageData;

  export default image;
}

import Image from 'next/image';

/** The box of each size, and how wide a picture in it is on the screen. */
const sizes = {
  sm: { box: 'size-7.5 text-xs', picture: '30px' },
  md: { box: 'size-10 text-[15px]', picture: '40px' },
} as const;

const tones = {
  brand: 'bg-brand',
  pink: 'bg-pink',
} as const;

interface AvatarProps {
  /** The person's name, or the email when there is no name. */
  readonly name: string;
  /** A picture shown in place of the initials, for example the logo of a store. */
  readonly imageUrl?: string | null;
  readonly size?: keyof typeof sizes;
  readonly tone?: keyof typeof tones;
}

/** Up to two letters for a person: the first letters of the first two words. */
export function initials(name: string): string {
  const words = name
    .split(/[\s._@-]+/)
    .filter((word) => word.length > 0)
    .slice(0, 2);

  return words.map((word) => word.charAt(0).toUpperCase()).join('');
}

/** A round badge with the person's initials, or with a picture when there is one. */
export function Avatar({ name, imageUrl, size = 'sm', tone = 'brand' }: AvatarProps) {
  const { box, picture } = sizes[size];

  return (
    <span
      aria-hidden
      className={`relative inline-flex flex-none items-center justify-center overflow-hidden rounded-full font-extrabold text-white ${box} ${
        imageUrl ? 'bg-gray-100' : tones[tone]
      }`}
    >
      {imageUrl ? (
        // The API stores small copies of a picture, so nothing resizes it again.
        <Image src={imageUrl} alt="" fill sizes={picture} unoptimized className="object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

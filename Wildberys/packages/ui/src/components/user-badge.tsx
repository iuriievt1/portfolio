import { Avatar } from './avatar';

const tones = {
  light: { name: 'text-[13px] font-extrabold text-berry-950', detail: 'text-xs text-gray-600' },
  dark: { name: 'text-[13px] font-bold text-white', detail: 'text-[11.5px] text-white/55' },
} as const;

interface UserBadgeProps {
  /** Light for the top bar, dark for the sidebar of the admin. */
  readonly tone: keyof typeof tones;
  /** The person's name, or the email when there is no name. */
  readonly name: string;
  /** A second line under the name, for example the person's roles. */
  readonly detail?: string;
}

/** The signed-in person: initials, the name and a short line under it. */
export function UserBadge({ tone, name, detail }: UserBadgeProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} />
      <div className="min-w-0">
        <div className={`truncate ${tones[tone].name}`}>{name}</div>
        {detail ? (
          <div className={`truncate font-semibold ${tones[tone].detail}`}>{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

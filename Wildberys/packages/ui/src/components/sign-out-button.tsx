import { LogOut } from 'lucide-react';

interface SignOutButtonProps {
  /** What the button does, for screen readers and as a hint. */
  readonly label: string;
  /** The address of the app that signs out. */
  readonly href: string;
}

/**
 * A plain form, not an action of the app: the browser loads the answer in full,
 * so the pages of the signed-in person do not stay in its memory.
 */
export function SignOutButton({ label, href }: SignOutButtonProps) {
  return (
    <form method="post" action={href}>
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="flex size-11 flex-none items-center justify-center rounded-sm bg-gray-100 text-berry-950 transition-colors outline-none hover:bg-gray-200 focus-visible:ring-4 focus-visible:ring-berry-500/14 [&_svg]:size-5"
      >
        <LogOut />
      </button>
    </form>
  );
}

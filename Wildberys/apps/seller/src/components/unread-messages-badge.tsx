import { getUnreadCount } from '../messages/messages';

/** The number of unread messages of Bluberi, next to the link to the messages. Nothing when all are read. */
export async function UnreadMessagesBadge() {
  const count = await getUnreadCount();

  return count > 0 ? (
    <span className="ml-auto flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-pink-500 px-1.5 text-[11px] font-extrabold text-white tabular-nums">
      {count}
    </span>
  ) : null;
}

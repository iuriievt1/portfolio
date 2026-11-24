import { MailOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/** The inbox with no conversation open: the right side says what to do. */
export default async function MessagesPage() {
  const t = await getTranslations('messages');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-berry-100 text-berry-600 [&_svg]:size-6">
        <MailOpen />
      </span>
      <p className="max-w-64 text-sm font-semibold text-gray-600">{t('choose')}</p>
    </div>
  );
}

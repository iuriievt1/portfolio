import { NewConversationForm, ThreadFrame } from '@bluberi/ui/components/inbox';
import { getMessages as getTexts, getTranslations } from 'next-intl/server';

import { localizedPath } from '../../../../../i18n/paths';
import { openConversation } from '../../../../../messages/actions';
import { messageMaxLength, messagesPath, subjectMaxLength } from '../../../../../messages/messages';

/** A new letter to the Bluberi team: a subject and a text. */
export default async function NewMessagePage({ params }: PageProps<'/[locale]/zpravy/nova'>) {
  const { locale } = await params;
  const t = await getTranslations('messages');
  const { errors } = await getTexts();

  return (
    <ThreadFrame
      title={t('newTitle')}
      subtitle={t('toTeam')}
      backHref={localizedPath(messagesPath, locale)}
      backLabel={t('back')}
    >
      <div className="w-full max-w-2xl rounded-md border border-gray-200 bg-white p-4">
        <NewConversationForm
          subjectLabel={t('subjectLabel')}
          bodyLabel={t('bodyLabel')}
          sendLabel={t('send')}
          subjectMaxLength={subjectMaxLength}
          bodyMaxLength={messageMaxLength}
          errors={errors}
          send={openConversation.bind(null, locale)}
        />
      </div>
    </ThreadFrame>
  );
}

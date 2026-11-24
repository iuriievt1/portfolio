import { getTranslations } from 'next-intl/server';

import { CardSection } from '../card-section';
import { Fact, Facts } from '../facts';
import { textLinkClasses } from '../text-link';

interface SellerContactsProps {
  readonly email: string;
  readonly phone: string;
}

/** How to reach the seller. A click writes an email or calls. */
export async function SellerContacts({ email, phone }: SellerContactsProps) {
  const t = await getTranslations('sellers.card.contacts');

  return (
    <CardSection title={t('title')}>
      <Facts>
        <Fact label={t('email')}>
          <a href={`mailto:${email}`} className={textLinkClasses}>
            {email}
          </a>
        </Fact>
        <Fact label={t('phone')}>
          <a href={`tel:${phone}`} className={textLinkClasses}>
            {phone}
          </a>
        </Fact>
      </Facts>
    </CardSection>
  );
}

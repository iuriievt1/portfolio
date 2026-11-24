import type { SellerTraceability } from '@bluberi/api-client';
import { CircleCheck, CircleX } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { dayAndTime } from '../../sellers/formats';
import { CardSection } from '../card-section';
import { Fact, Facts } from '../facts';

/** What Article 30 of the Digital Services Act asks a marketplace to have about a trader, in the order it is shown. */
const items = [
  'contacts',
  'address',
  'identityDocument',
  'paymentAccount',
  'registrationNumber',
  'selfCertification',
] as const satisfies readonly (keyof SellerTraceability)[];

interface SellerTraceabilityProps {
  readonly traceability: SellerTraceability;
  readonly termsAcceptedAt: string;
  /** Null until the seller promises to offer only goods that comply with the law of the EU. */
  readonly selfCertifiedAt: string | null;
}

/** Which of the data the Digital Services Act asks for Bluberi has about the seller. */
export async function SellerTraceabilityList({
  traceability,
  termsAcceptedAt,
  selfCertifiedAt,
}: SellerTraceabilityProps) {
  const t = await getTranslations('sellers.card');
  const format = await getFormatter();

  return (
    <CardSection title={t('traceability.title')}>
      <ul className="grid gap-x-6 gap-y-2 text-sm font-bold @lg:grid-cols-2 [&_svg]:size-4.5 [&_svg]:flex-none">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            {/* The mark has a name, so a screen reader says what the colour shows. */}
            {traceability[item] ? (
              <CircleCheck
                role="img"
                aria-label={t('traceability.present')}
                className="text-green-500"
              />
            ) : (
              <CircleX role="img" aria-label={t('traceability.missing')} className="text-red-500" />
            )}
            {t(`traceability.items.${item}`)}
          </li>
        ))}
      </ul>
      <Facts className="mt-4 border-t border-gray-200 pt-4">
        <Fact label={t('traceability.termsAccepted')}>
          {format.dateTime(new Date(termsAcceptedAt), dayAndTime)}
        </Fact>
        <Fact label={t('traceability.selfCertified')}>
          {selfCertifiedAt ? format.dateTime(new Date(selfCertifiedAt), dayAndTime) : t('no')}
        </Fact>
      </Facts>
    </CardSection>
  );
}

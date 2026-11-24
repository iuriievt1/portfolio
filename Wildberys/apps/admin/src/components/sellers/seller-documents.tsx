import type { SellerDocumentInfo, SellerDocumentKind } from '@bluberi/api-client';
import { Badge } from '@bluberi/ui/components/badge';
import { ExternalLink, FileText } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { dayAndTime } from '../../sellers/formats';
import { sellerDocumentPath } from '../../sellers/paths';
import { CardNote, CardSection } from '../card-section';

const megabyte = 1024 * 1024;

const row =
  'flex items-center gap-3 rounded-sm border px-3.5 py-2.5 [&_svg]:size-4.5 [&_svg]:flex-none';

interface SellerDocumentsProps {
  readonly sellerId: string;
  readonly documents: readonly SellerDocumentInfo[];
  /** The kinds a seller of this country has to give before the registration is sent. */
  readonly requiredDocuments: readonly SellerDocumentKind[];
}

/**
 * The documents of a seller. A click opens one in a new tab, through a route of the admin:
 * the files have no public address. A required document the seller did not give is listed as missing.
 */
export async function SellerDocuments({
  sellerId,
  documents,
  requiredDocuments,
}: SellerDocumentsProps) {
  const t = await getTranslations('sellers.card.documents');
  const format = await getFormatter();
  const missing = requiredDocuments.filter(
    (kind) => !documents.some((document) => document.kind === kind),
  );

  return (
    <CardSection title={t('title')}>
      {documents.length === 0 && missing.length === 0 ? (
        <CardNote>{t('empty')}</CardNote>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {documents.map((document) => (
            <li key={document.id}>
              {/* A plain link: nothing loads the file ahead, so the audit log has only real openings. */}
              <a
                href={sellerDocumentPath(sellerId, document.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={`border-gray-200 text-gray-400 transition-colors outline-none hover:border-berry-300 hover:bg-berry-50 hover:text-berry-500 focus-visible:ring-4 focus-visible:ring-berry-500/14 ${row}`}
              >
                <FileText />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold text-berry-950">{t(`kinds.${document.kind}`)}</span>
                  <span className="text-[13px] font-semibold break-words text-gray-600">
                    {t('details', {
                      name: document.fileName,
                      // A small file is said in kilobytes, a large one in megabytes.
                      size:
                        document.sizeBytes < megabyte
                          ? format.number(Math.ceil(document.sizeBytes / 1024), {
                              style: 'unit',
                              unit: 'kilobyte',
                            })
                          : format.number(document.sizeBytes / megabyte, {
                              style: 'unit',
                              unit: 'megabyte',
                              maximumFractionDigits: 1,
                            }),
                      date: format.dateTime(new Date(document.createdAt), dayAndTime),
                    })}
                  </span>
                </span>
                <ExternalLink role="img" aria-label={t('opensInNewTab')} />
              </a>
            </li>
          ))}
          {missing.map((kind) => (
            <li key={kind} className={`border-dashed border-gray-300 text-gray-400 ${row}`}>
              <FileText />
              <span className="min-w-0 flex-1 font-bold text-gray-600">{t(`kinds.${kind}`)}</span>
              <Badge tone="amber">{t('notUploaded')}</Badge>
            </li>
          ))}
        </ul>
      )}
    </CardSection>
  );
}

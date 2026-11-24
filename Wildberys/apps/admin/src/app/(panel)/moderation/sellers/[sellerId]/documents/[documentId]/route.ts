import { sellerModerationOpenDocument } from '@bluberi/api-client';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { connection } from 'next/server';

import { authConfig } from '../../../../../../../auth/config';
import { isId } from '../../../../../../../sellers/ids';

/**
 * A document is confidential: a copy of an identity document, a record of a register.
 * Neither the browser nor anything between keeps what this route answers.
 */
const confidential = {
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
};

/** An answer without the file, with the status that says why. */
function refused(status: number): Response {
  return new Response(null, { status, headers: confidential });
}

/**
 * Opens a document of a seller in the browser. The files have no public address: the admin asks
 * the API for the file as the signed-in person, and the API writes the opening to the audit log.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/moderation/sellers/[sellerId]/documents/[documentId]'>,
): Promise<Response> {
  // Runs for a real request only, never when the app is built.
  await connection();

  const { sellerId, documentId } = await params;

  // An address typed by hand may hold anything. The API is asked only with ids.
  if (!isId(sellerId) || !isId(documentId)) {
    return refused(404);
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return refused(401);
  }

  const { data, response } = await sellerModerationOpenDocument({
    client,
    path: { sellerId, documentId },
    parseAs: 'blob',
  });

  if (!data || !response?.ok) {
    // The status of the API: no access, no such document. 502 when the API cannot be reached.
    return refused(response?.status ?? 502);
  }

  const disposition = response.headers.get('content-disposition');

  return new Response(data, {
    headers: {
      ...confidential,
      'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
      // The file is shown in the tab, never saved by itself. The API adds the name of the file.
      'content-disposition': disposition?.startsWith('inline') ? disposition : 'inline',
    },
  });
}

import type { Response } from 'express';

export const requestIdHeader = 'x-request-id';

/** The id that logRequests gave to the request behind this response. */
export function getRequestId(response: Response): string {
  return String(response.getHeader(requestIdHeader));
}

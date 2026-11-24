import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/**
 * The two sides write to each other while the portal is open to the seller:
 * from the moment the registration is sent, unless the team refused or stopped the seller.
 */
export function messagesClosed(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'MESSAGES_CLOSED',
    'Messages are open only while the seller has the portal',
  );
}

/** No such conversation, or it belongs to another seller. */
export function conversationNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    'CONVERSATION_NOT_FOUND',
    'No conversation with this id',
  );
}

import { Controller, Param, Sse, type MessageEvent } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';

import { RequirePlatformAccess, RequireSellerRole } from '../access/access.decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SellerMemberRole } from '../generated/prisma/enums.js';
import { concernsSeller, concernsTeamMember, liveSections } from './audience.js';
import { eventStream } from './event-stream.js';
import { LiveEvents } from './live-events.js';
import { SellerStreamParams } from './live-streams.dto.js';

/** How a stream of changes is described in the API documentation. */
const description =
  'A stream of server-sent events for a page that is open. "ready" says that the page is heard from now on: ' +
  'what changed before is seen only after the page reads again. "change" says that something changed and names it: ' +
  'a conversation, a seller, the list of people who get the news. It never carries the content. ' +
  'The stream ends with the access token it was opened with, and the browser opens a new one.';

const answer = { description: 'The stream of events', schema: { type: 'string' } } as const;

/** What the open pages of the seller portal listen to. */
@ApiTags('Live events')
@Controller('sellers/:sellerId/events')
@RequireSellerRole([SellerMemberRole.OWNER, SellerMemberRole.STAFF])
export class SellerLiveStreamController {
  constructor(private readonly live: LiveEvents) {}

  @Sse()
  @ApiOperation({ summary: 'Hear at once that something about the seller changed', description })
  @ApiProduces('text/event-stream')
  @ApiOkResponse(answer)
  changes(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerStreamParams,
  ): Observable<MessageEvent> {
    return eventStream(this.live.events, concernsSeller(sellerId), auth.accessExpiresAt);
  }
}

/** What the open pages of the admin listen to. A person hears the changes of the sections they may open. */
@ApiTags('Live events')
@Controller('admin/events')
@RequirePlatformAccess(liveSections.map((area) => ({ area, level: 'view' })))
export class TeamLiveStreamController {
  constructor(private readonly live: LiveEvents) {}

  @Sse()
  @ApiOperation({
    summary: 'Hear at once that something in the admin changed',
    description,
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse(answer)
  changes(@CurrentAuth() auth: AuthContext): Observable<MessageEvent> {
    return eventStream(
      this.live.events,
      concernsTeamMember(auth.platformRoles),
      auth.accessExpiresAt,
    );
  }
}

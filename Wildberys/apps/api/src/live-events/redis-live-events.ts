import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { Subject } from 'rxjs';

import { AppConfig } from '../config/app-config.js';
import { LiveEvents, type Change, type LiveEvent } from './live-events.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isId(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}

/** What came from the channel, as a change. Undefined for anything this version does not know. */
export function toChange(message: string): Change | undefined {
  let heard: unknown;

  try {
    heard = JSON.parse(message);
  } catch {
    return undefined;
  }

  if (typeof heard !== 'object' || heard === null) {
    return undefined;
  }

  const { kind, sellerId, conversationId } = heard as Record<string, unknown>;

  switch (kind) {
    case 'conversation-changed':
      return isId(sellerId) && isId(conversationId)
        ? { kind, sellerId, conversationId }
        : undefined;
    case 'seller-changed':
      return isId(sellerId) ? { kind, sellerId } : undefined;
    case 'newsletter-changed':
      return { kind };
    default:
      return undefined;
  }
}

/**
 * Live events over a channel of Redis: a copy of the API publishes a change, and every copy,
 * the one that published too, hears it and passes it to the pages that are open on it.
 *
 * Redis is a help here, not a must: without it the API works, and pages show a change
 * when they are read again. When the channel comes back, the pages are told to read again.
 */
@Injectable()
export class RedisLiveEvents extends LiveEvents implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RedisLiveEvents.name);
  private readonly heard = new Subject<LiveEvent>();
  private readonly channel: string;
  /** A connection that listens to a channel can do nothing else, so there are two. */
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  /** The channel is subscribed to. Until then, and after every break, something may go unheard. */
  private subscribed = false;
  private reportedDown = false;

  readonly events = this.heard.asObservable();

  constructor(config: AppConfig) {
    super();
    this.channel = `${config.redisNamespace}:live-events`;
    // Nothing connects until the API really starts: the OpenAPI export builds the app without Redis.
    this.publisher = new Redis(config.redisUrl, {
      lazyConnect: true,
      // A report that cannot go out now is dropped at once and never holds a request.
      enableOfflineQueue: false,
    });
    this.subscriber = new Redis(config.redisUrl, {
      lazyConnect: true,
      // The subscription waits for the connection as long as it takes.
      maxRetriesPerRequest: null,
    });
  }

  onApplicationBootstrap(): void {
    for (const connection of [this.publisher, this.subscriber]) {
      connection.on('error', (error: Error) => {
        this.connectionFailed(error);
      });
      connection.on('ready', () => {
        this.connectionReady();
      });
    }

    // After a break the connection subscribes again by itself, and is "ready" once more.
    this.subscriber.on('ready', () => {
      if (this.subscribed) {
        this.heard.next({ kind: 'events-missed' });
      }
    });
    this.subscriber.on('message', (_channel: string, message: string) => {
      const change = toChange(message);

      if (change) {
        this.heard.next(change);
      }
    });

    // A failed first try is reported through the "error" event, and the connection keeps trying.
    this.publisher.connect().catch(() => undefined);
    this.subscriber.connect().catch(() => undefined);
    this.subscriber.subscribe(this.channel).then(
      () => {
        this.subscribed = true;
        // A page that was heard before the channel was is told to read again.
        this.heard.next({ kind: 'events-missed' });
      },
      (error: unknown) => {
        this.logger.error('Could not subscribe to live events', error);
      },
    );
  }

  onModuleDestroy(): void {
    // Ends every open stream, so the server can close without waiting for the pages.
    this.heard.complete();
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }

  async report(change: Change): Promise<void> {
    try {
      await this.publisher.publish(this.channel, JSON.stringify(change));
    } catch (error) {
      this.logger.warn('A live event was not sent', {
        kind: change.kind,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private connectionReady(): void {
    if (this.reportedDown) {
      this.reportedDown = false;
      this.logger.log('Redis is reachable again');
    }
  }

  /** The connections try again by themselves, many times a minute. One line per outage is enough. */
  private connectionFailed(error: Error): void {
    if (!this.reportedDown) {
      this.reportedDown = true;
      this.logger.error('Redis is not reachable, pages get no live updates', {
        reason: error.message,
      });
    }
  }
}
